---
"@sbtools/sdk": minor
"@sbtools/plugin-migration-studio": minor
---

Add Migration Studio Platform — brownfield adoption toolchain and workflow engine

**`@sbtools/sdk`**

- feat: add `studio-types.ts` — `IntentGraph`, `EntityNode`, `PolicyNode`, `FunctionNode`, `ViewNode`, `TriggerNode`, `InfraNode`, `OpaqueBlock`, `WorkflowRun`, `WorkflowStep`, `ReleaseGate` and related types
- feat: export `WorkflowStep` from SDK index for use by plugin workflow definitions

**`@sbtools/plugin-migration-studio`**

- feat: `studio-introspect` tool — queries live DB via `pg_catalog` / `information_schema`, produces full `studio.schema.snapshot` artifact with EntityNode[], PolicyNode[], ViewNode[], FunctionNode[], TriggerNode[], InfraNode[]
- feat: `studio-sql-parse` tool — reads migration `.sql` files, parses with `@supabase/pg-parser` WASM, extracts intent nodes per file, produces `studio.sql.ast` artifact with aggregated entity/policy/function arrays
- feat: `studio-intent-sync` tool — matches DB snapshot vs SQL AST by stable ID, confidence-scores each entity (base 0.85, column bonuses, missing-column penalties; DB-only=0.35, SQL-only=0.70), produces `studio.intent.sync-report` artifact
- feat: `studio-intent-init` tool — builds typed `IntentGraph` from sync report; high-confidence entities → `managed`, medium → `assisted`, low/DB-only → `OpaqueBlock`; produces `studio.intent.graph` artifact
- feat: workflow engine (`engine/runner.ts`) — sequential pipeline runner with checkpoint-pause/resume, failure isolation, `skipWhen` support, and full audit trail via `studio.workflow.run` artifact
- feat: `adopt-backend` workflow definition — 4-step brownfield adoption pipeline with two human checkpoints (review after sql-parse, approve before intent-init)
- feat: enrich `SchemaSnapshotData` — replaced summary arrays with full typed node arrays (`EntityNode[]`, etc.)
- feat: enrich `SqlAstData` and `SqlAstFileEntry` — add per-file and aggregated extracted node arrays for downstream tools
