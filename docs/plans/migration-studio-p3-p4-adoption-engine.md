# Migration Studio — Priority 3 & 4: Brownfield Adoption Chain + Workflow Engine

## Context

Priority 1 & 2 are complete (28/28 tests pass, `npm test` clean):

- `sdk/src/studio-types.ts` — all intent graph / workflow TypeScript interfaces
- `sdk/src/index.ts` — barrel exports
- `plugin-migration-studio/src/artifacts/constants.ts` — artifact ID constants
- `plugin-migration-studio/src/artifacts/writers.ts` — typed writer factories
- `plugin-migration-studio/src/artifacts/schemas.ts` — Zod validation schemas
- `plugin-migration-studio/src/sql-parser.ts` — WASM parser (`parseMigrationSql`, `extractSchemaNodes`)

## Goal

Implement the brownfield adoption chain (4 tools) and a minimal workflow engine that wires them together as the first real workflow.

---

## Part A — Artifact Shape Updates

`SchemaSnapshotData` and `SqlAstFileEntry` are currently summary-only. `intent-sync` needs full structured node arrays to do confidence matching.

### A1. Update `writers.ts`

**`SchemaSnapshotData`** — replace summary arrays with full node arrays:

```ts
// BEFORE
entities: Array<{ id: string; schema: string; name: string; managedStatus: ManagedStatus; columnCount: number }>;
views: Array<{ id: string; schema: string; name: string; materialized: boolean }>;
functions: Array<{ id: string; schema: string; name: string; language: string; security: string }>;
policies: Array<{ id: string; entity: string; name: string; command: string }>;
triggers: Array<{ id: string; entity: string; name: string }>;
extensions: Array<{ name: string; version?: string }>;

// AFTER
entities: EntityNode[];
views: ViewNode[];
functions: FunctionNode[];
policies: PolicyNode[];
triggers: TriggerNode[];
extensions: InfraNode[];
```

Add imports for `EntityNode`, `ViewNode`, `FunctionNode`, `PolicyNode`, `TriggerNode`, `InfraNode` from `@sbtools/sdk`.

**`SqlAstFileEntry`** — add extracted node arrays per file:

```ts
// ADD these fields:
extractedEntities: Partial<EntityNode>[];
extractedPolicies: Partial<PolicyNode>[];
extractedFunctions: Partial<FunctionNode>[];
extractedViews: Partial<ViewNode>[];
extractedInfrastructure: Partial<InfraNode>[];
```

**`SqlAstData`** — add aggregated totals:

```ts
// ADD these fields:
allEntities: Partial<EntityNode>[];
allPolicies: Partial<PolicyNode>[];
allFunctions: Partial<FunctionNode>[];
```

### A2. Update `schemas.ts`

Update `schemaSnapshotSchema` to use the full `entityNodeSchema`, `viewNodeSchema`, etc. (already defined in the file) instead of the inline summary schemas.

Update `sqlAstSchema` to include the new `extractedEntities`, `extractedPolicies`, etc. fields using `z.array(entityNodeSchema.partial())` (partial because SQL-extracted nodes are not always complete).

---

## Part B — Tool Implementations

All tools live in `packages/plugin-migration-studio/src/tools/`.
All have signature: `export async function run*(ctx: PluginContext): Promise<void>`

### B1. `tools/introspect.ts`

Queries the live DB via `createPgClient` (from SDK) and writes a full `SchemaSnapshotData`.

**DB URL source:** `ctx.pluginConfig?.db?.url || ctx.pluginConfig?.dbUrl`

**Queries to run (all exclude system schemas: `auth`, `storage`, `realtime`, `supabase_functions`, `extensions`, `pg_catalog`, `information_schema`):**

```sql
-- Tables
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_type = 'BASE TABLE'
  AND table_schema NOT IN ($SYSTEM_SCHEMAS)
ORDER BY table_schema, table_name;

-- Columns (grouped per table via app-side aggregation)
SELECT table_schema, table_name, column_name, data_type,
       is_nullable, column_default, character_maximum_length
FROM information_schema.columns
WHERE table_schema NOT IN ($SYSTEM_SCHEMAS)
ORDER BY table_schema, table_name, ordinal_position;

-- Constraints
SELECT conname, contype, connamespace::regnamespace::text AS schema_name,
       conrelid::regclass::text AS table_name,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE connamespace::regnamespace::text NOT IN ($SYSTEM_SCHEMAS);

-- Indexes
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname NOT IN ($SYSTEM_SCHEMAS);

-- Policies
SELECT p.polname, n.nspname AS schema_name, c.relname AS table_name,
       p.polcmd, p.polpermissive,
       pg_get_expr(p.polqual, p.polrelid) AS using_expr,
       pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expr,
       ARRAY(
         SELECT r.rolname FROM pg_roles r
         WHERE r.oid = ANY(p.polroles)
       ) AS roles
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ($SYSTEM_SCHEMAS);

-- Views
SELECT table_schema, table_name, view_definition, false AS materialized
FROM information_schema.views
WHERE table_schema NOT IN ($SYSTEM_SCHEMAS)
UNION ALL
SELECT schemaname, matviewname, definition, true
FROM pg_matviews
WHERE schemaname NOT IN ($SYSTEM_SCHEMAS);

-- Functions
SELECT routine_schema, routine_name, external_language,
       security_type, routine_definition, data_type AS return_type
FROM information_schema.routines
WHERE routine_type = 'FUNCTION'
  AND routine_schema NOT IN ($SYSTEM_SCHEMAS);

-- Triggers
SELECT trigger_name, event_object_schema, event_object_table,
       action_timing, event_manipulation, action_orientation
FROM information_schema.triggers
WHERE trigger_schema NOT IN ($SYSTEM_SCHEMAS);

-- Extensions
SELECT extname, extversion FROM pg_extension;

-- Postgres version
SELECT version();
```

**Node construction:**
- Tables + columns → `EntityNode[]` with `managedStatus: 'opaque'`, `confidence: 0.35` (DB-discovered, not yet in intent graph)
- Policies → `PolicyNode[]` with `managedStatus: 'opaque'`, `confidence: 0.35`
- Functions → `FunctionNode[]` with `managedStatus: 'opaque'`, `confidence: 0.35`
- Views → `ViewNode[]` with `managedStatus: 'opaque'`, `confidence: 0.35`
- Triggers → `TriggerNode[]` with `managedStatus: 'opaque'`, `confidence: 0.35`
- Extensions → `InfraNode[]` with `managedStatus: 'opaque'`

Policy `polcmd` mapping: `r`→`SELECT`, `a`→`INSERT`, `w`→`UPDATE`, `d`→`DELETE`, `*`→`ALL`.

**Error handling:** throw `{ code: 'DB_CONNECT_ERROR', message }` if connection fails; log and continue on individual query failure.

**Call:** `writeSchemaSnapshotArtifact(ctx, data)` at the end.

### B2. `tools/sql-parse.ts`

Walks the migrations directory, parses each `.sql` file, writes `SqlAstData`.

```ts
import fs from "node:fs";
import path from "node:path";
import { parseMigrationSql, extractSchemaNodes } from "../sql-parser.js";
import { writeSqlAstArtifact } from "../artifacts/writers.js";
```

**Steps:**
1. Resolve dir: `ctx.paths.migrations` (fall back to `path.join(ctx.projectRoot, 'supabase/migrations')`)
2. `fs.readdirSync(dir)` → filter `.sql` → sort alphabetically
3. For each file:
   - `parseMigrationSql(content, filename)` → `ParsedSql`
   - `extractSchemaNodes(parsedSql.statements)` → `ExtractedNodes`
   - Build `SqlAstFileEntry` including `extractedEntities`, `extractedPolicies`, etc.
4. Aggregate allEntities / allPolicies / allFunctions across files (deduplicated by id)
5. `writeSqlAstArtifact(ctx, data)`

If migrations dir does not exist: write empty artifact (no files) rather than throwing.

### B3. `tools/intent-sync.ts`

Compares DB snapshot vs SQL AST, produces a confidence-scored sync report.

**Reads:**
- `studio.schema.snapshot` via `readArtifactOrNull<SchemaSnapshotData>(ctx, STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id, STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.version)`
- `studio.sql.ast` via `readArtifactOrNull<SqlAstData>(ctx, ...)`
- `studio.intent.graph` (optional) via same pattern

**Confidence scoring (per entity):**

| Situation | Base confidence | Notes |
|---|---|---|
| In both DB and SQL AST | 0.85 | Highest confidence |
| Column count matches exactly | +0.05 bonus | Capped at 1.0 |
| Each mismatched column | -0.10 penalty | Floor 0.0 |
| DB only (no matching SQL migration) | 0.35 | Unknown provenance |
| SQL only (in migrations but not in DB) | 0.70 | Declared, not applied |

**Threshold mapping:**
- `confidence >= 0.80` → `managedStatus: 'managed'`
- `0.50 <= confidence < 0.80` → `managedStatus: 'assisted'`
- `confidence < 0.50` → `managedStatus: 'opaque'`

**Entity ID:** `${schema}.${name}` (e.g., `public.users`)

**Output:**
```ts
IntentSyncData {
  syncedAt: ISO string,
  matched: [{ objectId, objectType: 'entity', confidence, driftDetails? }],
  unmatchedDb: [{ objectId, objectType: 'entity', reason: 'no_sql_source' }],
  unmatchedIntent: [{ objectId, objectType: 'entity' }],
  summary: { matchedCount, unmatchedDbCount, unmatchedIntentCount, averageConfidence }
}
```

**Error if prerequisites missing:** throw `{ code: 'MISSING_ARTIFACT', artifact: 'studio.schema.snapshot' }` — the runner will catch and record as step failure.

### B4. `tools/intent-init.ts`

Builds the `IntentGraph` from the sync report and snapshot data.

**Reads:** `studio.intent.sync-report`, `studio.schema.snapshot`, `studio.sql.ast`

**Steps:**
1. For each matched entry in sync report: pull the `EntityNode` from snapshot data, set `managedStatus` based on confidence threshold (≥0.80→managed, ≥0.50→assisted, else opaque).
2. For each unmatchedDb entry: set `managedStatus: 'opaque'`, `confidence: 0.35`.
3. For each unmatchedIntent entry (SQL-only): build entity from `SqlAstData.allEntities`, `managedStatus: 'opaque'`, `confidence: 0.70`.
4. Set `mode`: if ≥80% of entities are `managed` → `'brownfield-managed'`, else `'brownfield-assisted'`.
5. Build `IntentGraph` with entities, policies, functions, views, triggers from snapshot.
6. Set `managedScope.schemas` for each non-system schema.
7. `writeIntentGraphArtifact(ctx, data)`.

---

## Part C — Workflow Engine

### C1. `engine/runner.ts` (~120 lines)

```ts
import type { PluginContext } from "@sbtools/sdk";
import type { WorkflowRun } from "@sbtools/sdk";
import { writeWorkflowRunArtifact } from "../artifacts/writers.js";
import { randomUUID } from "node:crypto";

export type StudioToolFn = (ctx: PluginContext) => Promise<void>;
export type ToolRegistry = Record<string, StudioToolFn>;

export interface WorkflowStepDef {
  id: string;
  toolName: string;
  checkpoint?: "review" | "approve";
  skipWhen?: (run: WorkflowRun) => boolean;
}

export interface WorkflowDefinition {
  id: string;
  steps: WorkflowStepDef[];
}
```

**`startWorkflow(def, ctx, registry)`:**
1. Create `WorkflowRun` with `id: randomUUID()`, `status: 'running'`, `currentStep: 0`, `steps: []`.
2. `writeWorkflowRunArtifact(ctx, run)`.
3. Call `_executeFrom(0, def, run, ctx, registry)` and return result.

**`resumeWorkflow(run, ctx, registry)`:**
1. If `run.status !== 'waiting_checkpoint'` throw `{ code: 'INVALID_RESUME', message }`.
2. Set `run.status = 'running'`, advance `currentStep` past the checkpoint step.
3. Call `_executeFrom(run.currentStep, def, run, ctx, registry)`.

**`_executeFrom(startIndex, def, run, ctx, registry)` — main loop:**
```
for i = startIndex to def.steps.length - 1:
  step = def.steps[i]
  run.currentStep = i

  if step.skipWhen?.(run):
    record StepResult(status: 'skipped')
    continue

  try:
    await registry[step.toolName](ctx)
    record StepResult(status: 'completed', startedAt, completedAt)
  catch err:
    record StepResult(status: 'failed', error: err.message)
    run.status = 'failed'
    writeWorkflowRunArtifact(ctx, run)
    return run

  if step.checkpoint:
    run.status = 'waiting_checkpoint'
    writeWorkflowRunArtifact(ctx, run)
    return run  // pause — caller resumes

run.status = 'completed'
writeWorkflowRunArtifact(ctx, run)
return run
```

### C2. `workflows/adopt-backend.ts`

```ts
import type { WorkflowDefinition } from "../engine/runner.js";
import { runIntrospect } from "../tools/introspect.js";
import { runSqlParse } from "../tools/sql-parse.js";
import { runIntentSync } from "../tools/intent-sync.js";
import { runIntentInit } from "../tools/intent-init.js";

export const ADOPT_BACKEND_TOOLS = {
  "studio-introspect": runIntrospect,
  "studio-sql-parse": runSqlParse,
  "studio-intent-sync": runIntentSync,
  "studio-intent-init": runIntentInit,
};

export const adoptBackendWorkflow: WorkflowDefinition = {
  id: "adopt-backend",
  steps: [
    { id: "introspect",   toolName: "studio-introspect" },
    { id: "sql-parse",    toolName: "studio-sql-parse" },
    { id: "intent-sync",  toolName: "studio-intent-sync",  checkpoint: "review" },
    { id: "intent-init",  toolName: "studio-intent-init",  checkpoint: "approve" },
  ],
};
```

---

## Part D — Tests

### D1. `tests/tools/introspect.test.ts`

Use `vi.mock('pg', ...)` to provide a mock `Client`. Test:
- `runIntrospect` builds `EntityNode[]` with correct columns from query results
- System schemas (`auth`, `storage`, etc.) are excluded
- `managedStatus: 'opaque'` and `confidence: 0.35` on all DB-discovered nodes
- `writeSchemaSnapshotArtifact` is called (spy on artifact writer)
- Throws `DB_CONNECT_ERROR` when connection fails

### D2. `tests/tools/sql-parse.test.ts`

Use `vi.mock('node:fs', ...)` to provide fixture SQL files. Test:
- `runSqlParse` calls `parseMigrationSql` and `extractSchemaNodes` per file
- `SqlAstFileEntry` contains correct `extractedEntities`, `extractedPolicies`
- `allEntities` is aggregated correctly across files
- Empty migrations dir writes artifact with `files: []`
- `writeSqlAstArtifact` is called

### D3. `tests/tools/intent-sync.test.ts`

Provide in-memory fixture artifacts (no disk I/O). Test:
- Entity in both DB + SQL → confidence 0.85 (+ adjustments)
- Column count match bonus (+0.05)
- Each missing column → penalty (-0.10, floor 0.0)
- DB-only entity → confidence 0.35
- SQL-only entity → confidence 0.70
- Summary counts correct
- Throws `MISSING_ARTIFACT` when snapshot not found

### D4. `tests/tools/intent-init.test.ts`

Fixture sync reports with known confidence values. Test:
- confidence ≥ 0.80 → `managedStatus: 'managed'`
- 0.50–0.79 → `'assisted'`
- < 0.50 → `'opaque'`
- `mode: 'brownfield-managed'` when ≥80% managed
- `mode: 'brownfield-assisted'` when <80% managed
- `writeIntentGraphArtifact` is called with correct graph

### D5. `tests/engine/runner.test.ts`

Mock tool functions (vi.fn()). Test:
- `startWorkflow` executes all steps in order
- Step failure → `run.status = 'failed'`, remaining steps not executed
- Checkpoint step → `run.status = 'waiting_checkpoint'`, subsequent steps not executed
- `resumeWorkflow` continues from after the checkpoint
- `skipWhen: () => true` → step skipped, execution continues
- `writeWorkflowRunArtifact` called after each state change

---

## Implementation Order

1. `writers.ts` — update `SchemaSnapshotData`, `SqlAstFileEntry`, `SqlAstData` (A1)
2. `schemas.ts` — update Zod schemas to match (A2)
3. `tools/introspect.ts` (B1)
4. `tools/sql-parse.ts` (B2)
5. `tools/intent-sync.ts` (B3)
6. `tools/intent-init.ts` (B4)
7. `engine/runner.ts` (C1)
8. `workflows/adopt-backend.ts` (C2)
9. All 5 test files (D1–D5)
10. `npm test` — verify all pass

## No New Dependencies

`pg` is already in `plugin-migration-studio/package.json`. No new packages needed.
The SDK already exports `createPgClient`, `readArtifactOrNull`, `disconnectClient`.
