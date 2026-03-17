---
description: Full-stack backend design platform — understand, design, generate, validate, and apply schema changes with confidence.
---

# Migration Studio Platform

[![npm](https://img.shields.io/npm/v/@sbtools/plugin-migration-studio.svg)](https://www.npmjs.com/package/@sbtools/plugin-migration-studio)

The Migration Studio Platform is a workflow-driven backend design system that replaces raw SQL authoring with structured intent. It covers five layers:

1. **Understand** — Introspect your live DB and parse migrations into a confidence-scored *intent graph*
2. **Design** — Visual Schema Builder in the dashboard (tables, policies, functions, RPCs, views)
3. **Generate** — Scaffold tools write migration files from intent; no raw SQL authoring needed
4. **Validate** — RLS coverage check, migration lint, RPC security audit, release gate
5. **Apply** — Gate-enforced apply with snapshot staleness detection and audit log

Works for both brownfield (existing Postgres/Supabase projects) and greenfield (start from scratch).

## Quick Start

**Brownfield (existing project):**
```bash
sbt studio-adopt            # introspect DB + parse migrations → intent graph
sbt studio-release-check    # one-shot: rls-check + rpc-lint + lint + release-gate (exits 0/1)
sbt migration-studio        # open editor, apply
```

**CI / pre-push hook (no server needed):**
```bash
sbt studio-release-check --json | jq '.status'   # → "pass" or "fail"
```

**Greenfield (new project):**
```bash
sbt studio-greenfield-init            # create empty intent graph
# open dashboard → Schema Builder → design tables and policies
sbt studio-release-gate               # run gate
sbt migration-studio                  # apply
```

## Commands

### Layer 1 — Understand

| Command | Description |
|---------|-------------|
| `studio-introspect` | Query live DB → `studio.schema.snapshot` |
| `studio-sql-parse` | Parse migration files → `studio.sql.ast` |
| `studio-adopt` | Full adoption workflow (introspect → sql-parse → review → intent-sync → approve → intent-init) |
| `studio-catalog [--audience <backend-dev\|business\|mixed>] [--mode <managed\|assisted\|loose>] [--type <tools\|workflows\|all>]` | List discovered tools/workflows from catalog with persona/control-mode filters |
| `studio-intent-patch --entity <id> --action <exclude\|set-status> [--status managed\|assisted]` | Mutate a single entity's managed-status in the intent graph |
| `studio-endpoint-map` | Derive PostgREST `EndpointNode` declarations for all managed entities and public-schema functions |

### Layer 2 — Generate

| Command | Description |
|---------|-------------|
| `studio-greenfield-init` | Initialize an empty intent graph (mode: `greenfield`) |
| `studio-create-table --schema <s> --name <n> [--no-rls]` | `CREATE TABLE` migration |
| `studio-add-column --entity <schema.table> --name <col> --type <type> [--nullable] [--default <val>]` | `ALTER TABLE ... ADD COLUMN` (requires intent graph) |
| `studio-add-rls-policy --entity <id> --name <n> --command <SELECT\|...> --roles <r> [--using <expr>]` | `CREATE POLICY` migration |
| `studio-add-index --entity <id> --name <n> --columns <cols> [--unique]` | `CREATE INDEX` migration |
| `studio-add-constraint --entity <id> --name <n> --type <fk\|unique\|check>` | `ALTER TABLE ... ADD CONSTRAINT` |
| `studio-add-function --schema <s> --name <n> --returns <type> --language <sql\|plpgsql> --body-file <path>` | `CREATE OR REPLACE FUNCTION` |
| `studio-create-rpc --name <n> --returns <type> --language <sql\|plpgsql> --body-file <path>` | Same as add-function, forces `schema: public` |
| `studio-create-view --schema <s> --name <n> --query "SELECT ..."` | `CREATE OR REPLACE VIEW` |

### Layer 4 — Validate

| Command | Description |
|---------|-------------|
| `studio-rls-check` | RLS coverage check per managed entity → `studio.rls.plan` + `studio.rls.report` |
| `studio-rpc-lint` | Function security audit (DEFINER/search_path/exposure) → `studio.rpc.plan` |
| `studio-migration-plan` | Diff intent graph vs DB snapshot, classify changes → `studio.migration.plan` |
| `studio-lint` | Lint migration files (destructive ops, naming, lock safety) → `studio.migration.lint` |
| `studio-migration-lint` | Alias for `studio-lint` |
| `studio-release-gate` | Aggregate all findings → pass/fail decision → `studio.release.gate` |
| `studio-release-check` | **One-shot:** run full release-check workflow without a server. Exits 0 on pass, 1 on fail. `--json` for raw output. |

## Pipeline

```
Live DB ──────────────────► introspect ──────► studio.schema.snapshot
Migration files (.sql) ────► sql-parse  ──────► studio.sql.ast
                                                       │
                                              intent-sync (confidence scoring)
                                                       │
                                              studio.intent.sync-report
                                                       │
                                              intent-init (build graph)
                                                       │
                                              studio.intent.graph
```

Each step produces a **versioned artifact** written to `.sbt/artifacts/`. Artifacts are JSON files with stable IDs — readable, diffable, and usable as inputs to downstream tools.

## The adoption workflow

The **adopt-backend** workflow runs all four tools in sequence with two human checkpoints:

| Step | Tool | Output artifact | Checkpoint |
|------|------|-----------------|------------|
| 1 | `studio-introspect` | `studio.schema.snapshot` | — |
| 2 | `studio-sql-parse` | `studio.sql.ast` | — |
| — | *(review confidence scores)* | — | **review** |
| 3 | `studio-intent-sync` | `studio.intent.sync-report` | — |
| — | *(confirm managed scope)* | — | **approve** |
| 4 | `studio-intent-init` | `studio.intent.graph` | — |

After step 2 the workflow pauses. You review the sync report to see which entities were matched between DB and migrations, and at what confidence. After you approve, `intent-init` builds the final intent graph.

### Workflow catalog (current)

| Workflow | Steps | Status |
|------|-------|--------|
| `adopt-backend` | `studio-introspect -> studio-sql-parse -> studio-intent-sync -> studio-intent-init` | Implemented |
| `release-check` | `studio-rls-check -> studio-rpc-lint -> studio-lint -> studio-release-gate` | Implemented |
| `create-table` | `studio-create-table -> studio-lint` | Implemented (guided workflow definition) |
| `add-rls-policy` | `studio-add-rls-policy -> studio-rls-check` | Implemented (guided workflow definition) |

## What each tool produces

### `studio-introspect` → `studio.schema.snapshot`

Queries `pg_catalog` and `information_schema` for the live state of your database:

- All user tables with full column definitions (type, nullable, default, identity, generated)
- Constraints (PRIMARY KEY, UNIQUE, CHECK, FOREIGN KEY)
- Indexes (method, uniqueness, partial predicate)
- RLS policies (command, roles, USING/WITH CHECK expressions)
- Functions (language, security type, return type)
- Views and materialized views
- Triggers
- Extensions

System schemas (`auth`, `storage`, `realtime`, `supabase_functions`, `extensions`, `pg_catalog`, `information_schema`) are excluded from all queries.

```json
// .sbt/artifacts/studio.schema.snapshot/1.0.0/latest.json
{
  "id": "studio.schema.snapshot",
  "version": "1.0.0",
  "data": {
    "capturedAt": "2025-01-15T14:22:31.000Z",
    "pgVersion": "PostgreSQL 15.6",
    "entities": [
      {
        "id": "public.users",
        "schema": "public",
        "name": "users",
        "managedStatus": "managed",
        "confidence": 0.9,
        "columns": [
          { "name": "id", "type": "uuid", "nullable": false, "default": "gen_random_uuid()" },
          { "name": "email", "type": "text", "nullable": false },
          { "name": "created_at", "type": "timestamptz", "nullable": true, "default": "now()" }
        ],
        "constraints": [
          { "name": "users_pkey", "type": "primary_key", "columns": ["id"], "definition": "PRIMARY KEY (id)" }
        ],
        "indexes": []
      }
    ],
    "policies": [...],
    "extensions": [
      { "id": "extension:uuid-ossp", "type": "extension", "name": "uuid-ossp", "details": { "version": "1.1" } }
    ]
  }
}
```

### `studio-sql-parse` → `studio.sql.ast`

Reads every `.sql` file in your migrations directory alphabetically. For each file:

- Parses all statements using `@supabase/pg-parser` (real Postgres C parser compiled to WASM)
- Extracts structured intent nodes: entities, policies, functions, views, triggers, extensions
- Runs the regex analyzer for risk metadata (destructive ops, transaction wrapping)
- Records opaque blocks (DO $$ ... $$, statements that don't map to an intent node type)

All extracted nodes are aggregated into `allEntities`, `allPolicies`, etc. for easy access by downstream tools.

```json
// .sbt/artifacts/studio.sql.ast/1.0.0/latest.json
{
  "data": {
    "migrationsDir": "supabase/migrations",
    "parsedAt": "2025-01-15T14:22:35.000Z",
    "files": [
      {
        "filename": "20240101_init.sql",
        "statementCount": 4,
        "opaqueBlockCount": 1,
        "entities": [{ "id": "public.users", "schema": "public", "name": "users", "columns": [...] }],
        "policies": [{ "id": "public.users.users_select", "command": "SELECT", "roles": ["authenticated"] }],
        "riskMeta": { "riskFlags": { "hasTransaction": true, "hasDestructive": false } }
      }
    ],
    "allEntities": [...],
    "allPolicies": [...]
  }
}
```

### `studio-intent-sync` → `studio.intent.sync-report`

Matches entities between the DB snapshot and the SQL AST by their stable ID (`schema.name`). Produces a confidence score per entity:

| Condition | Score |
|-----------|-------|
| Entity found in both DB and migration files (base) | 0.85 |
| Column count exactly matches | +0.05 |
| All column names match | +0.05 |
| All column types match | +0.03 |
| Each column in DB missing from SQL | −0.10 |
| Each type mismatch per column | −0.05 |
| Entity in DB only (no migration found) | **0.35 fixed** |
| Entity in migrations only (not yet in DB) | **0.70 fixed** |

Score ≥ 0.80 → `managed`. 0.50–0.79 → `assisted`. < 0.50 → `opaque`.

```json
// .sbt/artifacts/studio.intent.sync-report/1.0.0/latest.json
{
  "data": {
    "syncedAt": "2025-01-15T14:22:37.000Z",
    "matched": [
      { "objectId": "public.users", "objectType": "entity", "confidence": 0.98 },
      { "objectId": "public.orders", "objectType": "entity", "confidence": 0.73, "driftDetails": "column 'legacy_id' in DB but not in SQL" }
    ],
    "unmatchedDb": [
      { "objectId": "public.audit_log", "objectType": "entity", "reason": "no_sql_source" }
    ],
    "unmatchedIntent": [
      { "objectId": "public.invoices", "objectType": "entity" }
    ],
    "summary": {
      "matchedCount": 14,
      "unmatchedDbCount": 2,
      "unmatchedIntentCount": 1,
      "averageConfidence": 0.881
    }
  }
}
```

### `studio-intent-init` → `studio.intent.graph`

Builds the intent graph from the sync report. High-confidence entities become `managed` — the platform understands them well enough to generate, update, and lint changes. Low-confidence or DB-only entities become `opaque` blocks, preserved verbatim.

```json
// .sbt/artifacts/studio.intent.graph/1.0.0/latest.json
{
  "data": {
    "version": "1.0.0",
    "mode": "brownfield-managed",
    "entities": [
      {
        "id": "public.users",
        "managedStatus": "managed",
        "confidence": 0.98,
        "columns": [...]
      },
      {
        "id": "public.orders",
        "managedStatus": "assisted",
        "confidence": 0.73,
        "columns": [...]
      }
    ],
    "opaqueBlocks": [
      {
        "id": "entity:public.audit_log",
        "reason": "too-complex",
        "astAvailable": false,
        "touchedObjects": ["public.audit_log"]
      }
    ],
    "managedScope": {
      "schemas": { "public": "managed", "auth": "excluded" },
      "explicitExclusions": []
    }
  }
}
```

## Running the workflow

Run via CLI (`sbt studio-adopt`), dashboard Adoption page (`sbt migration-studio` then `sbt dashboard` → Adoption → Start Adoption), or API (`startWorkflow` / `resumeWorkflow` from `engine/runner.js`). The Adoption page fetches live data from the studio server (port 3335); it does not use `backend-atlas-data.json`.

## Scaffold Tools (Layer 3 — Generate)

All scaffold tools write a timestamped `.sql` migration file to your migrations directory and return `{ sql, filename }`. No DB connection required (except `studio-add-column`, which needs the intent graph).

| Tool | Generates | Intent graph required? |
|------|-----------|----------------------|
| `studio-create-table` | `CREATE TABLE ... ENABLE ROW LEVEL SECURITY` | No |
| `studio-add-column` | `ALTER TABLE ... ADD COLUMN ...` | Yes (entity must be managed) |
| `studio-add-rls-policy` | `CREATE POLICY "..." ON ... FOR ... TO ... USING (...)` | No |
| `studio-add-index` | `CREATE INDEX ... ON ... (...)` | No |
| `studio-add-constraint` | `ALTER TABLE ... ADD CONSTRAINT ...` | No |
| `studio-add-function` | `CREATE OR REPLACE FUNCTION ...` | No |
| `studio-create-rpc` | Same as add-function, forces `schema: public` | No |
| `studio-create-view` | `CREATE OR REPLACE VIEW schema.name AS <query>` | No |

## Validation Tools (Layer 4 — Validate)

Each validation tool reads existing artifacts and produces structured findings. No DB writes.

### `studio-rls-check` → `studio.rls.plan` + `studio.rls.report`

For every managed entity with RLS enabled:
- Verifies SELECT/INSERT/UPDATE/DELETE policy coverage (ALL command counts for all)
- Flags tables with no policies at all
- Flags SECURITY DEFINER functions that could bypass RLS

### `studio-rpc-lint` → `studio.rpc.plan`

For every `FunctionNode` in the intent graph:
- `DEFINER_NO_SEARCH_PATH` — definer function without `search_path` set (SQL injection risk)
- `DEFINER_PUBLIC_EXPOSURE` — definer function in public schema exposed to PostgREST without explicit auth guard
- `EMPTY_FUNCTION_BODY` — function registered in intent graph with no body

### `studio-migration-plan` → `studio.migration.plan`

Diffs the intent graph against the live DB snapshot. Classifies each change:

| Change class | Example | Safety |
|---|---|---|
| `additive_safe` | Add nullable column | Always safe |
| `additive_with_default` | Add NOT NULL column with default | Safe with lock note |
| `type_change_narrowing` | `text` → `varchar(100)` | Risky |
| `drop` | Drop column or table | Dangerous |
| `policy_change` | Update RLS expression | Review carefully |
| `constraint_change` | Add FK | Table scan required |

Additive changes are ordered first; destructive changes last. Includes a `snapshotHash` to detect stale plans.

### `studio-lint` → `studio.migration.lint`

Reads the SQL AST artifact. Checks per migration file:
- `TRUNCATE_DETECTED` — error (blocks release gate)
- `DROP_DETECTED` — warning
- `DESTRUCTIVE_NO_TRANSACTION` — warning (DROP/TRUNCATE not wrapped in transaction)
- `LOW_PARSE_CONFIDENCE` — info (high opaque block ratio)
- `NAMING_VIOLATION` — info (filename not timestamp-prefixed)

### `studio-release-gate` → `studio.release.gate`

Aggregates all findings from RLS report, RPC plan, and migration lint:
- Any lint error or RLS gap → `status: 'fail'` (blocking)
- Any warning → gate warning (non-blocking)
- `NO_VALIDATION` when no evidence artifacts exist

`POST /api/apply` reads this artifact. If `status === 'fail'` → 422 response, apply blocked. If no gate artifact → apply proceeds with a `gateWarning` in the response.

## Greenfield Workflow

For new projects with no existing DB:

```bash
sbt studio-greenfield-init   # creates empty intent graph (mode: 'greenfield')
# open dashboard → /schema-builder → design tables, policies, functions, views
# each "Generate Migration" button writes a .sql file to your migrations dir
sbt studio-release-gate      # validate before applying
sbt migration-studio         # apply via browser editor
```

## Intent Graph Mutation

After the adoption workflow, you can reclassify entities without re-running the full workflow:

```bash
# Exclude a table from management (e.g. a Supabase internal table)
sbt studio-intent-patch --entity public.audit_log --action exclude

# Promote an assisted entity to managed
sbt studio-intent-patch --entity public.orders --action set-status --status managed
```

The Adoption dashboard page provides the same functionality via per-row "Manage" and "Exclude" buttons with color-coded status badges.

## Endpoint Mapping

Derives PostgREST endpoint declarations from the intent graph:

```bash
sbt studio-endpoint-map
```

For each managed entity: creates a `table-crud` endpoint with `allowedRoles` derived from its RLS policies. For each managed public-schema function: creates an `rpc` endpoint. Results are written back into the intent graph as `EndpointNode[]`.

## Apply (Layer 5)

`POST /api/apply` in the migration studio server enforces the full apply safety chain:

1. **Gate check** — reads `studio.release.gate`; blocks with 422 if `status === 'fail'`
2. **Snapshot staleness** — reads `studio.migration.plan`'s `snapshotHash`, recomputes from current snapshot; includes `snapshotStale: true` in the response if the DB has changed since the plan was generated (non-blocking warning)
3. **Apply** — runs migrations
4. **Audit log** — writes `studio.apply.log` with `{ appliedAt, output, success: true }` for every successful apply

## Dashboard Integration

- **Adoption page** (`/adoption`) — workflow status, Start/Resume/Restart, step table, intent graph entity list with interactive status badges and "Manage"/"Exclude" buttons per row, "Map Endpoints" button. Requires `sbt migration-studio` running.
- **Schema Builder page** (`/schema-builder`) — visual forms for creating tables, RLS policies, functions, RPCs, and views; live SQL preview; "Initialize Greenfield Project" when no intent graph exists; Release Gate panel.
- **Overview** — intent entities appear as a tab after `sbt generate-atlas`. The plugin contributes `studio_intent_entities` via `getAtlasData()`.

## Reading the artifacts

All artifacts land in `.sbt/artifacts/` as `latest.json` files:

```
.sbt/artifacts/
  studio.schema.snapshot/1.0.0/latest.json        ← live DB state
  studio.sql.ast/1.0.0/latest.json                 ← migration file parse results
  studio.intent.sync-report/1.0.0/latest.json      ← confidence-scored match
  studio.intent.graph/1.0.0/latest.json            ← final intent graph + endpoints
  studio.workflow.run/1.0.0/latest.json            ← run state (step results, status)
  studio.rls.plan/1.0.0/latest.json                ← proposed RLS policies
  studio.rls.report/1.0.0/latest.json              ← coverage gaps and warnings
  studio.rpc.plan/1.0.0/latest.json                ← function security findings
  studio.migration.plan/1.0.0/latest.json          ← ordered SQL change plan
  studio.migration.lint/1.0.0/latest.json          ← migration file lint results
  studio.release.gate/1.0.0/latest.json            ← pass/fail release decision
  studio.apply.log/1.0.0/latest.json               ← most recent apply record
```

Read them from code:

```ts
import { readArtifactOrNull } from "@sbtools/sdk";
import type { SchemaSnapshotData } from "@sbtools/plugin-migration-studio/src/artifacts/writers.js";

const snapshot = readArtifactOrNull<SchemaSnapshotData>(ctx, "studio.schema.snapshot", "1.0.0");
if (snapshot) {
  console.log(`${snapshot.data.entities.length} tables found`);
  console.log(`${snapshot.data.policies.length} RLS policies`);
}
```

## Workflow engine

The engine (`engine/runner.ts`) is a ~120-line sequential pipeline runner with no external framework dependency:

```ts
import { startWorkflow, resumeWorkflow } from "...engine/runner.js";
import type { WorkflowStep, ToolRegistry } from "...engine/runner.js";
```

Key behaviors:

- **Sequential execution** — steps run in order; a step cannot start until the previous completes
- **Checkpoint pause** — steps with `checkpoint: 'review'` or `'approve'` pause the run and persist state; the caller resumes when ready
- **Failure isolation** — a failing step records the error in the run artifact and stops; subsequent steps are not called
- **Skip conditions** — steps with `skipWhen: (run) => boolean` are skipped if the condition holds at runtime
- **Full audit trail** — every step result (status, artifact produced, timestamps, error) is written to `studio.workflow.run`

Resuming a paused run:

```ts
// Load persisted run from artifact storage
const existingRun = loadWorkflowRun(ctx);
if (existingRun?.status === 'waiting_checkpoint') {
  const continued = await resumeWorkflow(existingRun, steps, ctx, registry);
}
```

## Artifact IDs

| Artifact | ID | Version | Written by |
|----------|----|---------|-----------|
| DB schema snapshot | `studio.schema.snapshot` | 1.0.0 | `studio-introspect` |
| SQL AST parse results | `studio.sql.ast` | 1.0.0 | `studio-sql-parse` |
| Confidence sync report | `studio.intent.sync-report` | 1.0.0 | `studio-intent-sync` |
| Intent graph | `studio.intent.graph` | 1.0.0 | `studio-intent-init`, `studio-intent-patch`, `studio-endpoint-map`, `studio-greenfield-init` |
| Workflow run | `studio.workflow.run` | 1.0.0 | workflow engine |
| RLS plan | `studio.rls.plan` | 1.0.0 | `studio-rls-check` |
| RLS coverage report | `studio.rls.report` | 1.0.0 | `studio-rls-check` |
| RPC security plan | `studio.rpc.plan` | 1.0.0 | `studio-rpc-lint` |
| Migration change plan | `studio.migration.plan` | 1.0.0 | `studio-migration-plan` |
| Migration lint results | `studio.migration.lint` | 1.0.0 | `studio-lint` |
| Release gate decision | `studio.release.gate` | 1.0.0 | `studio-release-gate` |
| Apply audit log | `studio.apply.log` | 1.0.0 | `POST /api/apply` |

## Confidence scoring explained

Confidence is a 0.0–1.0 score per entity node that answers: *"How well does the platform understand this object?"*

| Range | Status | What the platform does |
|-------|--------|------------------------|
| **0.80 – 1.0** | `managed` | Full management. Can generate, update, lint, gate. |
| **0.50 – 0.79** | `assisted` | Managed with caution. User must review before updates. |
| **< 0.50** | `opaque` | Preserved verbatim. Not touched by generation. |

An entity gets a high confidence score when:
- It appears in both the live DB and the migration files
- Its column names and types match between both sources
- There are no unexplained columns in the DB that don't appear in any migration

An entity gets a low confidence score when:
- It exists only in the DB with no migration history (manually created, seeded externally)
- Its DB columns diverge significantly from what the migrations declare

Opaque nodes are not deleted — they become `OpaqueBlock` entries in the intent graph with `reason: 'too-complex'`. Future tools can promote opaque nodes to assisted or managed as more intent graph node types are added.

## Managed scope rules

The platform never touches what it doesn't understand:

- **`managed`** — fully controlled; platform can generate and update SQL
- **`assisted`** — partially understood; user reviews before any changes
- **`opaque`** — unknown or too-complex; preserved verbatim, never rewritten
- **`excluded`** — explicitly opted out; ignored even if parseable

System schemas (`auth`, `storage`, `realtime`, etc.) are always `excluded`. User schemas default to `managed` in the scope declaration but individual objects within them may be `opaque` based on confidence.

## Dependencies

`pg` is required for `studio-introspect`. It is already listed in `plugin-migration-studio`'s dependencies.

`@supabase/pg-parser` (WASM) is required for `studio-sql-parse`. It lazy-loads the WASM binary on first parse call — no explicit initialization needed.

## See also

- [Migration Studio editor](./plugin-migration-studio.md) — the SQL authoring UI
- [Migration Audit](./plugin-migration-audit.md) — drift detection against the DB tracking table
- [Artifact Registry](../architecture/artifact-registry.md) — all artifact IDs in the project
- [Artifact Contract Guide](../architecture/artifact-contract-guide.md) — how to produce and consume artifacts
