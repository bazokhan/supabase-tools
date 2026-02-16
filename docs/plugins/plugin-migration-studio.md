---
description: Schema-aware migration authoring UI — CodeMirror 6 editor, autocomplete, templates, live analysis.
---

# plugin-migration-studio

Schema-aware migration authoring UI. CodeMirror 6 SQL editor with PostgreSQL dialect, table/column autocomplete, migration templates, and live analysis. Apply via the core `sbt migrate` flow.

## Features

- **CodeMirror 6 editor** — Syntax highlighting, line numbers, bracket matching, search (Ctrl+F), undo/redo
- **Schema-aware autocomplete** — Tables, columns, functions, types (from DB → atlas-data → artifact)
- **Live analysis** — Operations, risk flags, touched objects (debounced, updates as you type)
- **Migration templates** — Create table with RLS, add column, function, trigger, policy, index, FK, enum
- **Context sidebar** — Migrations list (from disk + `migration.analysis` status), schema tree; click to load or insert
- **Save / Update** — Update overwrites a loaded pending migration; Save as new always creates a new file
- **Dry run** — Validates SQL (same format as migrate); shows success or error before apply
- **Wrap in transaction** — Wraps selected or full SQL in `BEGIN;` … `COMMIT;`
- **Apply** — Requires confirmation, runs `sbt migrate`

## Installation

```bash
npm install @sbtools/plugin-migration-studio
```

## Activation

```json
{
  "plugins": [
    { "path": "@sbtools/plugin-migration-studio", "config": {} }
  ]
}
```

## Usage

```bash
sbt migration-studio
```

Starts the studio at `http://localhost:3335`. Use `--port N` to change the port. If the port is in use, the server automatically kills the existing process and restarts. Use `--restart` to force-kill before starting.

## API Endpoints (internal)

The studio serves a local HTTP server with:

- `GET /` — Editor page
- `GET /api/events` — Server-Sent Events refresh channel
- `GET /api/schema` — Schema introspection (DB → atlas-data → artifact)
- `GET /api/templates` — Migration template list
- `GET /api/migrations` — Migration files with status
- `GET /api/migration/:filename` — SQL content of a migration file
- `POST /api/analyze` — Analyze SQL (operations, risk flags)
- `POST /api/save` — Save migration file (body: `{ sql, description?, filename? }` — `filename` overwrites existing pending migration)
- `POST /api/validate` — Dry run: validate SQL (same format as migrate)
- `POST /api/apply` — Run `sbt migrate`

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| (none) | — | — | No config options yet |

## Contract

- **Produces:** `migration.studio.draft` (planned)
- **Consumes:** `migration.analysis` (optional — enriches migrations list and schema fallback)

Apply path uses core migration execution; no duplicate engine.

## Refresh requirements (real-time updates)

| Feature | Requires | Command |
|---------|----------|---------|
| Migrations list with status | `migration.analysis` artifact | `sbt migration-audit` |
| Schema from atlas cache | `docs/backend-atlas-data.json` | `sbt generate-atlas` |
| Live refresh push | `.sbt/watch/last-event.json` + artifact changes | `sbt watch` |

Studio exposes `GET /api/events` (SSE). When watch updates arrive, Studio invalidates cache and refetches schema/migrations without full page reload.

**Note:** `migration.analysis` is written only by `sbt migration-audit`, not by `sbt generate-atlas`. See [Package & Artifact Dependencies](../architecture/package-dependencies.md) for the full map.

## Dependencies

Requires `pg` for database schema introspection (optional peer; studio degrades to atlas-data/artifact when DB unreachable).
