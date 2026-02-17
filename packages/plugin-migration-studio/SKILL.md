# @sbtools/plugin-migration-studio

## Purpose

Browser-based migration authoring UI for supabase-tools. Provides a SQL editor with live analysis, save/apply flow, and SSE-based live refresh when `sbt watch` updates artifacts.

## When to Use

Use this skill when the user needs to:
- Modify the migration studio UI or editor
- Change the SQL analysis integration
- Update the server/API endpoints
- Fix migration save/apply behavior
- Modify the SSE live-refresh bridge

## Architecture

Self-contained HTTP server plugin. The server renders an HTML page with an embedded SQL editor and communicates with the backend via REST API + SSE.

### Server

`src/server.ts` — Node.js HTTP request handler providing:
- `GET /` — Serves the editor HTML page (rendered by `@sbtools/ui-web`)
- `GET /api/migrations` — Lists migration files from disk
- `GET /api/status` — Current migration status (applied vs pending)
- `POST /api/save` — Save a new or updated migration file
- `POST /api/apply` — Apply pending migrations (delegates to `sbt migrate`)
- `POST /api/analyze` — Analyze SQL using shared `analyzeMigrationSql`
- `GET /api/events` — SSE endpoint for live refresh

### Editor Page

Rendered by `renderMigrationStudioPage` from `@sbtools/ui-web`. Features:
- CodeMirror 6 SQL editor
- Live analysis panel showing operations and risk indicators
- Migration list sidebar
- Save/apply controls with confirmation dialogs

## File Layout

```
plugin-migration-studio/
├── src/
│   ├── index.ts          # Plugin entry: SbtPlugin export, server startup, port management
│   ├── server.ts         # HTTP request handler (REST API + SSE)
│   └── html/
│       └── editor-page.ts # Editor page data/config (delegates rendering to ui-web)
├── README.md
└── package.json
```

## Commands

```
sbt migration-studio              Start the studio server (default port 3335)
sbt migration-studio --port N     Use port N
sbt migration-studio --restart    Kill existing server on port, then start
sbt migration-studio -h/--help    Show help
```

## Contract

- **Produces:** `migration.studio.draft` (planned)
- **Consumes:** `migration.analysis` (optional — for richer context when migration-audit has run)
