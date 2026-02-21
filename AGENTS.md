# Claude Code — Project Notes

> Mirror policy: `CLAUDE.md` and `AGENTS.md` are synchronized copies in this repo. Update both files in the same commit whenever instructions change.

## Planning

**Write the plan file first, implement second.** For any non-trivial task:

1. **Write the plan** to `docs/plans/<kebab-case-title>.md` before touching any code. Never write plan files to a temp directory or outside the repo.
2. **Stop and wait for confirmation.** Do not implement until the user explicitly approves the plan.
3. **Then implement** once confirmed.

This order is mandatory. A plan written after implementation is useless — it can't be reviewed, corrected, or handed off before work is done.

## CLAUDE.md Maintenance

**Always keep the `## Codebase Architecture` section in this file up to date.** After any task that changes the documented structure, update the relevant part before finishing:

- New or removed package → update the Packages table
- New key file or renamed entry point → update Key Files
- Changed plugin contract / config schema / API routes → update those sections
- Changed build steps or script names → update Build & Scripts

This file is loaded at the start of every session. Keeping it accurate eliminates redundant repo exploration.

## GitHub Issues

**Labels:** Use standard GitHub labels (`bug`, `enhancement`, `documentation`) plus project-specific labels for affected areas (e.g. `plugin-system`, `path-resolution`). Create area labels as needed — use them to make filtering useful, not for decoration.

**Titles:** Should reflect the actual scope found during investigation, not just the reporter's initial description. Keep them concrete and scannable — state *what's broken* or *what's needed*, not the solution.

**Comments:** When posting an investigation or fix summary, include: what was found (root cause), what was changed (files + rationale), and any backward-compat notes. Use tables for multi-item comparisons.

**Scope expansion:** If an issue turns out to be broader than reported, update the title and labels to match the real scope. Note the expansion in your comment so the reporter understands.

## Build

- Monorepo with npm workspaces under `packages/`
- SDK must build first: `npm run build` handles this (builds sdk, then all workspaces)
- All packages use TypeScript with `tsc`

## Changesets

This repo uses `@changesets/cli`. Create changesets for any package whose public API or behavior changes. Group related changes into one changeset when they're part of the same fix.

---

## Codebase Architecture

### Packages

| Package | Purpose |
|---|---|
| `@sbtools/sdk` | Shared types, plugin contract interfaces, helpers (fs, db, cli, artifacts, migrations). No prod deps. Build first. |
| `@sbtools/core` | CLI entry point, command registry, plugin loader, snapshot/generate/dashboard/watch/migrate commands, HTTP server |
| `@sbtools/ui-web` | React SPA (Vite) + HTML renderers; served by core's dashboard command from `dist/dashboard/` |
| `@sbtools/plugin-erd` | Mermaid ERD generation; contributes `erd_diagrams` to atlas data and ERD page to dashboard |
| `@sbtools/plugin-migration-studio` | CodeMirror SQL editor; apply migrations from browser; SQL AST parsing via `@supabase/pg-parser`; artifact writers; brownfield adoption tools (introspect, sql-parse, intent-sync, intent-init); workflow engine; scaffold tools (add-column, add-function, create-rpc, create-table, add-rls-policy, add-index, add-constraint, create-view); greenfield init; validation tools (rls-check, migration-lint, rpc-lint, migration-plan, release-gate); intent graph mutation; endpoint mapping; CLI commands; studio server (port 3335) |
| `@sbtools/plugin-migration-audit` | Audit migration files vs DB tracking table; detect drift |
| `@sbtools/plugin-depgraph` | TypeScript function/table dependency graph |
| `@sbtools/plugin-typegen` | Generate TS types from Supabase `/pg/generators/typescript` |
| `@sbtools/plugin-db-test` | pgTAP runner via PGlite |
| `@sbtools/plugin-logs` | Docker log tailing + `pg_stat_statements` viewer |
| `@sbtools/plugin-deno-functions` | Scan and document Edge Functions |
| `@sbtools/plugin-frontend-usage` | Scan frontend code for Supabase SDK usage |
| `@sbtools/plugin-scaffold` | Generate new plugin boilerplate |

### Key Files

```
packages/sdk/src/
  index.ts            – barrel export
  plugin-api.ts       – SbtPlugin, PluginContext, DashboardView interfaces
  types.ts            – AtlasData, SnapshotMeta, FunctionItem, PolicyItem, etc.
  artifacts.ts        – .sbt/artifacts/ read/write helpers
  studio-types.ts     – IntentGraph, EntityNode, PolicyNode, FunctionNode, WorkflowRun, ReleaseGate, etc.

packages/plugin-migration-studio/src/
  artifacts/constants.ts  – STUDIO_ARTIFACTS id/version constants
  artifacts/writers.ts    – typed artifact writer factories (SchemaSnapshotData, SqlAstData, IntentSyncData, etc.)
  artifacts/schemas.ts    – Zod validation schemas for all studio artifacts
  sql-parser.ts           – WASM SQL parser (parseMigrationSql, extractSchemaNodes)
  tools/tool-definition.ts – tool contract (CLI/HTTP/workflow metadata + non-technical metadata)
  tools/discovery.ts      – convention-based tool discovery (`*.tool.ts`) and registry maps
  tools/core/*.core.ts    – tool core implementations (SQL/artifact logic) consumed by canonical modules + tests
  tools/modules/*.tool.ts – canonical self-contained tool modules (run + cli/http adapters + metadata)
  catalog.ts              – filterable catalog view (audience/mode/type) used by CLI and HTTP surfaces
  tools/introspect.ts     – DB queries → SchemaSnapshotData → studio.schema.snapshot
  tools/sql-parse.ts      – migration files → AST extraction → studio.sql.ast
  tools/intent-sync.ts    – DB vs SQL confidence scoring → studio.intent.sync-report
  tools/intent-init.ts    – build IntentGraph from sync report → studio.intent.graph
  tools/generate-add-column.ts  – ADD COLUMN migration from intent graph entity
  tools/generate-add-function.ts – CREATE FUNCTION migration
  tools/generate-create-rpc.ts – RPC migration (schema: public)
  tools/generate-create-table.ts – CREATE TABLE migration
  tools/generate-add-rls-policy.ts – CREATE POLICY migration
  tools/generate-add-index.ts – CREATE INDEX migration
  tools/generate-add-constraint.ts – ALTER TABLE ADD CONSTRAINT migration
  tools/generate-create-view.ts – CREATE OR REPLACE VIEW migration
  tools/greenfield-init.ts – initialize intent graph for a greenfield project
  tools/rls-check.ts      – RLS coverage check against intent graph
  tools/migration-lint.ts – risk flags, naming violations, lock-safety checks
  tools/rpc-lint.ts       – function security audit (authz, search_path, input validation)
  tools/migration-plan.ts – ordered SQL change plan with change-class annotations
  tools/release-gate.ts   – aggregated pass/fail gate with blocking reasons
  tools/intent-patch.ts   – mutate entity managed-status in the intent graph
  tools/endpoint-map.ts   – map PostgREST endpoints from intent graph entities/functions
  engine/runner.ts        – sequential pipeline runner (startWorkflow, resumeWorkflow)
  workflows/workflow-definition.ts – workflow contract type
  workflows/discovery.ts  – convention-based workflow discovery (`*.workflow.ts`)
  workflows/*.workflow.ts – workflow catalog definitions (adopt-backend, release-check, create-table, add-rls-policy)
  server.ts               – HTTP server on 3335; tool routes generated from discovered tool modules
  index.ts                – plugin entry; CLI commands generated from discovered tool modules
  tests/workflows/*.test.ts – workflow/catalog unit tests
  tests/e2e/*.test.ts     – DB-aware workflow e2e tests for all discovered workflows (real files + DB assertions)
  tests/e2e/harness/*.ts  – shared e2e utilities (temp context, DB preflight, SQL assertions, strict DB mode)
  docs/plugins/plugin-migration-studio-contributing.md – contributor guide for adding tools/workflows

packages/core/src/
  cli.ts              – entry; parses argv, loads plugins, dispatches commands
  command-registry.ts – central command lookup
  config.ts           – Zod config schema; loads supabase-tools.config.json
  plugin-loader.ts    – dynamic runtime import of plugins (no compile-time deps)
  commands/
    snapshot.ts       – extracts DB objects via SQL; writes to .sbt/snapshot/ (default)
    generate-data.ts  – builds backend-atlas-data.json; calls plugin.getAtlasData()
    dashboard.ts      – HTTP server on :3400; serves SPA + API routes
    watch.ts          – file/DB watcher; re-runs snapshot+generate on change
    migrate.ts        – applies .sql migrations via pg client
    docker.ts         – Docker Compose control (start/stop/restart)
    plugin.ts         – plugin management (list/add/remove/enable/disable)
    help.ts           – help output with Quick Start guide
    init.ts           – config creation and directory setup
  extractors/         – functions, views, triggers, policies, types, enums
  parsers/atlas-builders.ts – assembles AtlasData from snapshot files

packages/ui-web/src/
  dashboard/App.tsx          – main router; dark mode; search
  dashboard/hooks/           – useAtlasData, useDashboardConfig, useCommands, usePlugins, useServices
  dashboard/lib/model.ts     – route parsing, search indexing, nav building
  dashboard/pages/           – Overview, Details, Migrations, MigrationStudio, Depgraph, Logs, FrontendUsage, Erd, Runner, Adoption (tabbed: Readiness, Progress, Risk, API Surface, Overview, Entities, Graph, Endpoints, Policies, Opaque, Tools), SchemaBuilder, Plugins, Services
  renderers/                 – standalone HTML page generators (migration-audit, depgraph, logs-viewer)
```

### Dependency Graph

```
sdk  ←  core
sdk  ←  all plugins
sdk  ←  ui-web (via renderers)
ui-web ← core (serves dist/dashboard/)
ui-web ← plugins (use renderers)
```
Plugins have zero compile-time dependency on core. Loading is runtime-only via dynamic `import()`.

### Plugin Contract (sdk/src/plugin-api.ts)

```ts
interface SbtPlugin {
  name: string; version: string
  commands?: SbtPluginCommand[]
  getAtlasData?(ctx): PluginAtlasData        // contributes to backend-atlas-data.json
  getDashboardView?(): DashboardView          // declares sections for the React SPA
  getStatusLines?(ctx): Promise<string[]>
  getOpenApiSpec?(ctx): Promise<OpenAPI>
}

interface PluginContext {
  projectRoot, toolsDir, sbtDataDir, artifactsDir
  pluginConfig, apiUrl
  paths: { migrations, snapshot, docsOutput, functions }
}
```

### Config (supabase-tools.config.json → core/src/config.ts)

```json
{
  "paths": {
    "migrations": "supabase/migrations",
    "snapshot": ".sbt/snapshot",
    "docsOutput": ".sbt/docs",
    "functions": "supabase/functions"
  },
  "db": { "url", "container" },
  "api": { "url", "studioUrl", "inbucketUrl" },
  "project": { "name" },
  "plugins": [{ "path": "pkg-or-filepath", "enabled": true, "config": {} }]
}
```

`migrations` and `functions` are user-authored (committed). `snapshot` and `docsOutput` are generated outputs — both default to `.sbt/` (git-ignored).

### Dashboard API Routes (served by core/commands/dashboard.ts)

| Route | Returns |
|---|---|
| `GET /api/atlas-data` | `backend-atlas-data.json` |
| `GET /api/dashboard-config` | plugin-contributed section definitions |
| `GET /api/services` | Docker service statuses + local UI endpoint reachability |
| `GET /api/plugins` | built-in + configured plugin state (configured/enabled/installed/loaded) |
| `POST /api/plugins` | plugin config actions (`add`, `remove`, `enable`, `disable`), optional `add+install` |
| `GET /api/commands` | runnable command list with prerequisites and running-state metadata |
| `POST /api/run/stop` | stop a running long-lived command started from dashboard |
| `GET /api/events` | SSE event stream for plugin/command state changes |
| `GET /api/logs/stream` | SSE Docker log stream |
| `GET /api/fs/list` | snapshot/migrations/docs directory listing |
| `GET /api/fs/file` | raw file content |
| `GET /dependency-graph.html` | serves generated depgraph HTML from docsOutput |
| `GET /migration-audit.html` | serves generated audit HTML from docsOutput |

### Migration Studio API Routes (port 3335, plugin-migration-studio/server.ts)

| Route | Returns |
|---|---|
| `GET /api/schema` | Live DB schema (tables, columns, policies, functions) |
| `GET /api/templates` | Migration template list |
| `GET /api/migrations` | Migration file list |
| `POST /api/analyze` | SQL analysis (parse + validate) |
| `POST /api/validate` | SQL validation against live schema |
| `POST /api/save` | Save SQL to a migration file |
| `POST /api/apply` | Apply pending migrations; includes `snapshotStale` flag and writes `studio.apply.log` |
| `POST /api/studio/introspect` | `{ entities, policies, infrastructure }` counts |
| `POST /api/studio/sql-parse` | `{ files, totalStatements, totalOpaqueBlocks }` |
| `GET /api/studio/intent-graph` | Full `IntentGraph` or `null` |
| `GET /api/studio/adopt/status` | `WorkflowRun` or `{ status: 'not_started' }` |
| `POST /api/studio/adopt/start` | `WorkflowRun` after checkpoint/completion |
| `POST /api/studio/adopt/resume` | `WorkflowRun` after next checkpoint/completion |
| `POST /api/studio/scaffold/add-column` | `{ sql, filename }` |
| `POST /api/studio/scaffold/add-function` | `{ sql, filename }` |
| `POST /api/studio/scaffold/create-rpc` | `{ sql, filename }` |
| `POST /api/studio/scaffold/create-table` | `{ sql, filename }` |
| `POST /api/studio/scaffold/add-rls-policy` | `{ sql, filename }` |
| `POST /api/studio/scaffold/add-index` | `{ sql, filename }` |
| `POST /api/studio/scaffold/add-constraint` | `{ sql, filename }` |
| `POST /api/studio/scaffold/create-view` | `{ sql, filename }` |
| `POST /api/studio/greenfield-init` | `{ mode, entities }` |
| `POST /api/studio/intent-graph/entity` | `IntentPatchResult` |
| `POST /api/studio/endpoint-map` | `{ entityEndpoints, rpcEndpoints, total }` |
| `POST /api/studio/rls-check` | `{ report, plan }` |
| `POST /api/studio/migration-lint` | `MigrationLintData` |
| `POST /api/studio/rpc-lint` | `RpcPlanData` |
| `POST /api/studio/migration-plan` | `MigrationPlanData` |
| `POST /api/studio/release-gate` | `ReleaseGateData` |

### Build & Scripts

```bash
npm run build          # builds sdk → ui-web → all packages → copy-dashboard.ts
npm run dev            # tsx packages/core/src/cli.ts (unbundled, fast iteration)
npm run test           # vitest on sdk, core, and plugins with tests
scripts/copy-dashboard.ts  # copies ui-web dist → core (runs after build)
```
Build order matters: **sdk must build before everything else**; `ui-web` must build before `core` packages the dashboard.
