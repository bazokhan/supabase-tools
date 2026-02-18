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
| `@sbtools/plugin-migration-studio` | CodeMirror SQL editor; apply migrations from browser |
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

packages/core/src/
  cli.ts              – entry; parses argv, loads plugins, dispatches commands
  command-registry.ts – central command lookup
  config.ts           – Zod config schema; loads supabase-tools.config.json
  plugin-loader.ts    – dynamic runtime import of plugins (no compile-time deps)
  commands/
    snapshot.ts       – extracts DB objects via SQL; writes to supabase/[type]/
    generate-data.ts  – builds backend-atlas-data.json; calls plugin.getAtlasData()
    dashboard.ts      – HTTP server on :3400; serves SPA + API routes
    watch.ts          – file/DB watcher; re-runs snapshot+generate on change
    migrate.ts        – applies .sql migrations via pg client
    docker.ts         – Docker Compose control
  extractors/         – functions, views, triggers, policies, types, enums
  parsers/atlas-builders.ts – assembles AtlasData from snapshot files

packages/ui-web/src/
  dashboard/App.tsx          – main router; dark mode; search
  dashboard/hooks/           – useAtlasData (/api/atlas-data), useDashboardConfig (/api/dashboard-config)
  dashboard/lib/model.ts     – route parsing, search indexing, nav building
  dashboard/pages/           – Overview, Details, Migrations, Depgraph, Logs, Erd, FrontendUsage
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
  "paths": { "migrations", "snapshot", "docsOutput", "functions" },
  "db": { "url", "container" },
  "api": { "url", "studioUrl", "inbucketUrl" },
  "project": { "name" },
  "plugins": [{ "path": "pkg-or-filepath", "enabled": true, "config": {} }]
}
```

### Dashboard API Routes (served by core/commands/dashboard.ts)

| Route | Returns |
|---|---|
| `GET /api/atlas-data` | `backend-atlas-data.json` |
| `GET /api/dashboard-config` | plugin-contributed section definitions |
| `GET /api/services` | Docker service statuses |
| `GET /api/logs/stream` | SSE Docker log stream |
| `GET /api/fs/list` | snapshot/migrations/docs directory listing |
| `GET /api/fs/file` | raw file content |
| `GET /dependency-graph.html` | serves generated depgraph HTML from docsOutput |
| `GET /migration-audit.html` | serves generated audit HTML from docsOutput |

### Build & Scripts

```bash
npm run build          # builds sdk → ui-web → all packages → copy-dashboard.ts
npm run dev            # tsx packages/core/src/cli.ts (unbundled, fast iteration)
npm run test           # vitest on sdk, core, and plugins with tests
scripts/copy-dashboard.ts  # copies ui-web dist → core (runs after build)
```
Build order matters: **sdk must build before everything else**; `ui-web` must build before `core` packages the dashboard.
