# Migration Studio Platform — Phase 5: CLI, HTTP Routes, Scaffold Workflows, Dashboard UI

## Context

Priority 1–4 are complete (parsing pipeline, artifact schemas, 4 brownfield adoption tools, workflow engine — 69 passing tests, docs, changeset). This plan covers the 4 remaining deferred items needed to make the platform usable end-to-end:

1. **CLI commands** — wire adoption tools into the terminal
2. **HTTP routes** — expose tools/workflow over HTTP for dashboard integration
3. **Scaffold workflows** — greenfield SQL generation (RPC function, stored function, add column)
4. **Custom React dashboard page** — Adoption page in the dashboard SPA

---

## Architecture Decisions

- **No new workflow definitions for scaffold tools** — single-step scaffolding doesn't benefit from the engine wrapper; tools are called directly from CLI commands and HTTP handlers.
- **Studio server (port 3335) owns all studio HTTP routes** — new routes follow the existing `Map<string, RouteHandler>` pattern in `server.ts`.
- **React page in `ui-web`** — the Adoption page fetches live data directly from the studio server (port 3335). It does NOT depend on stale atlas-data for workflow state.
- **`getAtlasData()` for overview integration** — the plugin also contributes intent graph entity list to `backend-atlas-data.json` so entities appear in the existing dashboard overview.
- **Scaffold tools write migration files** — output goes directly to `ctx.paths.migrations` with a timestamp prefix; no new artifact IDs needed.
- **Studio server URL in adoption page** — the page uses `window.location.hostname + ":3335"` (local dev assumption, same host).

---

## Task 1: CLI Commands

Three adoption commands + three scaffold commands added to `packages/plugin-migration-studio/src/index.ts`.

### `sbt studio-introspect`
```
$ sbt studio-introspect
Connecting to postgresql://localhost/...
Captured 12 tables, 8 policies, 3 extensions
Written to .sbt/artifacts/studio.schema.snapshot/1.0.0/latest.json
```
Calls `runIntrospect(ctx)`, prints entity/policy/infrastructure counts.

### `sbt studio-sql-parse`
```
$ sbt studio-sql-parse
Scanning supabase/migrations/ (7 files)...
Parsed 23 statements, 4 opaque blocks
Written to .sbt/artifacts/studio.sql.ast/1.0.0/latest.json
```
Calls `runSqlParse(ctx)`, prints file/statement summary.

### `sbt studio-adopt`
Runs the full adopt-backend workflow with interactive checkpoint pauses:
```
Step 1/4: introspect...  ✓
Step 2/4: sql-parse...   ✓

── Review: Confidence Report ──────────────────────────────
  public.users       0.98  managed    (matched DB + SQL)
  public.orders      0.73  assisted   (column 'legacy_id' in DB but not in SQL)
  public.audit_log   0.35  opaque     (no migration found)
───────────────────────────────────────────────────────────
Press ENTER to continue or Ctrl+C to abort:

Step 3/4: intent-sync...  ✓

── Approve: Managed Scope ──────────────────────────────────
  14 managed · 2 assisted · 1 opaque
───────────────────────────────────────────────────────────
Press ENTER to build intent graph or Ctrl+C to abort:

Step 4/4: intent-init...  ✓
Intent graph written to .sbt/artifacts/studio.intent.graph/1.0.0/latest.json
```

Shared helpers (inlined in `index.ts`):
- `promptUser(message: string): Promise<void>` — Node.js `readline.createInterface`
- `printSyncReport(ctx)` — reads `studio.intent.sync-report` artifact, formats table

### `sbt studio-add-column`
```
sbt studio-add-column --entity public.users --name avatar_url --type text [--nullable] [--default "''"]
```
Validates entity in intent graph (throws if opaque), generates `ALTER TABLE ... ADD COLUMN ...`, writes migration file.

### `sbt studio-add-function`
```
sbt studio-add-function --schema public --name clean_old_logs --returns void --language plpgsql --body-file ./fn.sql [--security definer]
```
Reads body from `--body-file` path or single-line `--body` flag. Writes migration file.

### `sbt studio-create-rpc`
```
sbt studio-create-rpc --name get_user_profile --params "user_id uuid" --returns "TABLE(id uuid, email text)" --language sql --body-file ./rpc.sql
```
Like `studio-add-function` but forces `schema: public` (PostgREST requirement).

**File:** `packages/plugin-migration-studio/src/index.ts` — MODIFY: add 6 commands, update `artifactCapabilities.produces`

---

## Task 2: HTTP Routes

Add to the `routes` Map in `packages/plugin-migration-studio/src/server.ts`:

### Adoption / introspection routes
| Route | Handler | Returns |
|---|---|---|
| `POST /api/studio/introspect` | `handleStudioIntrospect` | `{ entities, policies, infrastructure }` counts |
| `POST /api/studio/sql-parse` | `handleStudioSqlParse` | `{ files, totalStatements, totalOpaqueBlocks }` |
| `GET /api/studio/intent-graph` | `handleStudioIntentGraph` | Full `IntentGraph.data` or `null` |
| `GET /api/studio/adopt/status` | `handleStudioAdoptStatus` | `WorkflowRun` or `{ status: 'not_started' }` |
| `POST /api/studio/adopt/start` | `handleStudioAdoptStart` | `WorkflowRun` after first checkpoint/completion |
| `POST /api/studio/adopt/resume` | `handleStudioAdoptResume` | `WorkflowRun` after next checkpoint/completion |

### Scaffold routes
| Route | Handler | Body | Returns |
|---|---|---|---|
| `POST /api/studio/scaffold/add-column` | `handleAddColumn` | `{ entityId, column }` | `{ sql, filename }` |
| `POST /api/studio/scaffold/add-function` | `handleAddFunction` | function definition | `{ sql, filename }` |
| `POST /api/studio/scaffold/create-rpc` | `handleCreateRpc` | rpc definition | `{ sql, filename }` |

All handlers: synchronous, return JSON, errors → `{ error: message }` with 500.

`handleStudioAdoptStart` / `handleStudioAdoptResume`: run synchronously (DB queries + in-memory scoring finish fast). Resume handler uses `loadWorkflowRun(ctx)` to read persisted run.

**File:** `packages/plugin-migration-studio/src/server.ts` — MODIFY: add 9 routes + handler functions

---

## Task 3: Scaffold Tools

Three new pure tool files. No workflow engine wrapper needed (single-step operations).

### `src/tools/generate-add-column.ts`
```ts
export interface AddColumnInput {
  entityId: string;   // "public.users"
  column: { name: string; type: string; nullable: boolean; default?: string };
}
export async function runAddColumn(ctx: PluginContext, input: AddColumnInput): Promise<{ sql: string; filename: string }>
```
Logic:
1. Read `studio.intent.graph` — throw `{ code: 'MISSING_ARTIFACT' }` if not found
2. Find entity — throw `{ code: 'ENTITY_NOT_FOUND' }` if missing
3. Check `managedStatus !== 'opaque'` — throw `{ code: 'ENTITY_OPAQUE' }` if unmanaged
4. Generate SQL: `ALTER TABLE <schema>.<name> ADD COLUMN <col> <type>[NOT NULL][DEFAULT <val>];`
5. Write `<migrationsDir>/<timestamp>_add_column_<table>_<col>.sql`
6. Return `{ sql, filename }`

### `src/tools/generate-add-function.ts`
```ts
export interface AddFunctionInput {
  schema: string; name: string;
  params: Array<{ name: string; type: string }>;
  returnType: string;
  language: 'sql' | 'plpgsql';
  body: string;
  security?: 'invoker' | 'definer';  // default: 'invoker'
}
export async function runAddFunction(ctx: PluginContext, input: AddFunctionInput): Promise<{ sql: string; filename: string }>
```
Generates `CREATE OR REPLACE FUNCTION` SQL, writes `<timestamp>_add_function_<name>.sql`.

### `src/tools/generate-create-rpc.ts`
```ts
export type CreateRpcInput = Omit<AddFunctionInput, 'schema'>;
export async function runCreateRpc(ctx: PluginContext, input: CreateRpcInput): Promise<{ sql: string; filename: string }>
```
Same as `runAddFunction` but forces `schema: 'public'`. Writes `<timestamp>_create_rpc_<name>.sql`.

**Migration filename format:** `${Date.now()}_<type>_<slug>.sql`

**Tests (3 new files):**
- `tests/tools/generate-add-column.test.ts` — write fixture intent graph, call tool, verify SQL in written file; test `ENTITY_NOT_FOUND`, `ENTITY_OPAQUE`, `MISSING_ARTIFACT` errors; test nullable/default combinations
- `tests/tools/generate-add-function.test.ts` — call tool, verify `CREATE OR REPLACE FUNCTION` SQL shape, file written
- `tests/tools/generate-create-rpc.test.ts` — verify schema is forced to `public`, SQL shape correct

**Files created:**
- `packages/plugin-migration-studio/src/tools/generate-add-column.ts` — NEW
- `packages/plugin-migration-studio/src/tools/generate-add-function.ts` — NEW
- `packages/plugin-migration-studio/src/tools/generate-create-rpc.ts` — NEW
- `packages/plugin-migration-studio/tests/tools/generate-add-column.test.ts` — NEW
- `packages/plugin-migration-studio/tests/tools/generate-add-function.test.ts` — NEW
- `packages/plugin-migration-studio/tests/tools/generate-create-rpc.test.ts` — NEW

---

## Task 4: Dashboard UI

### Plugin side — `src/index.ts`

**Add `getAtlasData(ctx)`:**
Reads `studio.intent.graph` artifact (returns empty categories if not yet built):
```ts
getAtlasData: (ctx) => {
  const graph = readArtifactOrNull<IntentGraph>(ctx, STUDIO_ARTIFACTS.INTENT_GRAPH.id, '1.0.0');
  if (!graph) return { categories: {} };
  return {
    categories: {
      studio_intent_entities: graph.data.entities.map(e => ({
        id: e.id, schema: e.schema, name: e.name,
        managedStatus: e.managedStatus, confidence: e.confidence,
      })),
    },
  };
}
```

**Update `getDashboardView()`** — add second section for intent entity table:
```ts
{
  id: 'studio_intent_entities',
  title: 'Intent Graph',
  description: 'Managed, assisted, and opaque entities from the brownfield adoption scan.',
  dataKey: 'studio_intent_entities',
  layout: 'table',
  table: {
    columns: [
      { header: 'Entity', field: 'id' },
      { header: 'Schema', field: 'schema' },
      { header: 'Status', field: 'managedStatus' },
      { header: 'Confidence', field: 'confidence', format: 'number' },
    ],
  },
}
```

### React page — `packages/ui-web/src/dashboard/pages/AdoptionPage.tsx`

**Layout:**
```
┌───────────────────────────────────────────────────────────┐
│ Adoption Workflow                                          │
│ Status: waiting_checkpoint    [Start Adoption]  [Resume]  │
├───────────────────────────────────────────────────────────┤
│ Steps                                                     │
│ introspect   ✓ completed    studio.schema.snapshot        │
│ sql-parse    ✓ completed    studio.sql.ast                 │
│ intent-sync  ⏸ checkpoint   studio.intent.sync-report     │
│ intent-init  – pending      —                             │
├───────────────────────────────────────────────────────────┤
│ Intent Graph (14 entities)                                │
│ Entity          Status     Confidence                     │
│ public.users    managed    0.98                           │
│ public.orders   assisted   0.73                           │
└───────────────────────────────────────────────────────────┘
```

**Data fetching:**
- `studioBase = window.location.protocol + '//' + window.location.hostname + ':3335'`
- `GET <studioBase>/api/studio/adopt/status` — workflow run (polled every 3s when `status === 'running'`)
- `GET <studioBase>/api/studio/intent-graph` — intent entities (refreshed after start/resume)

**Button behavior:**
- "Start Adoption" → `POST .../adopt/start`, re-fetch both
- "Resume" → `POST .../adopt/resume`, re-fetch both
- "Restart" (on failed) → `POST .../adopt/start`, re-fetch both

**States:**
- `not_started` — "Start Adoption" button only, no step table
- `running` — spinner, poll every 3s
- `waiting_checkpoint` — "Resume" button + checkpoint name shown
- `completed` — all steps green, full intent graph table
- `failed` — error message, "Restart" button

### `App.tsx` changes:
- Add `'adoption'` to `RouteName` type
- Import + render `AdoptionPage` in route switch
- Add "Adoption" nav item — visible when `availability.adoption` is true
- `inferPluginAvailability`: set `adoption: true` when `sections.some(s => s.id === 'migration_studio')` (plugin loaded, regardless of intent graph state)

**Files modified/created:**
- `packages/ui-web/src/dashboard/pages/AdoptionPage.tsx` — NEW
- `packages/ui-web/src/dashboard/App.tsx` — MODIFY: add route + nav item + availability flag
- `packages/plugin-migration-studio/src/index.ts` — MODIFY: add `getAtlasData()`, update `getDashboardView()`

---

## Implementation Order

Tasks 2 and 3 are independent — implement in parallel. Task 1 shares imports with Task 3 (done after). Task 4 depends on Task 2 routes.

1. Task 2 (HTTP routes in `server.ts`) + Task 3 (scaffold tools + tests) — parallel
2. Task 1 (CLI commands in `index.ts`) — after Task 3 tools exist
3. Task 4 (React page + `getAtlasData`) — after Task 2 routes exist

---

## Out of Scope (future)

- Drop/rename column in `update-entity`
- RLS policy generation for scaffolded tables/RPCs
- `sbt studio-sync` as standalone command (covered by `sbt studio-adopt` steps 1–3)
- Interactive readline prompts for scaffold commands (initial version uses `--flags` only)

---

## Verification

```bash
# 1. Build
npm run build -w packages/plugin-migration-studio
npm run build -w packages/ui-web

# 2. Plugin tests (includes 3 new scaffold tool test files)
npx vitest run --config packages/plugin-migration-studio/vitest.config.ts

# 3. Full regression
npm test

# 4. Manual (requires running Supabase local)
sbt studio-introspect
sbt studio-sql-parse
sbt studio-adopt
sbt studio-add-column --entity public.users --name avatar_url --type text --nullable

# HTTP routes (studio running on 3335)
sbt migration-studio
curl -X POST http://localhost:3335/api/studio/introspect
curl http://localhost:3335/api/studio/adopt/status
curl -X POST http://localhost:3335/api/studio/adopt/start

# Dashboard Adoption page
sbt dashboard  # → http://localhost:3400 → "Adoption" nav item
```
