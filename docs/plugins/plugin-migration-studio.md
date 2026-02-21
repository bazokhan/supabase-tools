---
description: Schema-aware migration authoring UI — CodeMirror 6 editor, autocomplete, templates, live analysis.
---

# @sbtools/plugin-migration-studio

[![npm](https://img.shields.io/npm/v/@sbtools/plugin-migration-studio.svg)](https://www.npmjs.com/package/@sbtools/plugin-migration-studio)

Schema-aware migration authoring UI. CodeMirror 6 SQL editor with PostgreSQL dialect, table/column autocomplete, migration templates, and live analysis. Apply via the core `sbt migrate` flow.

## Features

- **CodeMirror 6 editor** — Syntax highlighting, line numbers, bracket matching, search (Ctrl+F), undo/redo
- **Modern dark studio theme** — Black-first visual styling aligned with dashboard look and readability
- **Schema-aware autocomplete** — Tables, columns, functions, types (from DB → atlas-data → artifact)
- **Live analysis** — Operations, risk flags, touched objects (debounced, updates as you type)
- **Migration templates** — Create table with RLS, add column, function, trigger, policy, index, FK, enum
- **Context sidebar** — Migrations list (from disk + `migration.analysis` status), schema tree; click to load or insert
- **Save / Update** — Update overwrites a loaded pending migration; Save as new always creates a new file
- **Dry run** — Validates SQL (same format as migrate); shows success or error before apply
- **Wrap in transaction** — Wraps selected or full SQL in `BEGIN;` … `COMMIT;`
- **Apply** — Requires confirmation, runs `sbt migrate`

## Dashboard Integration

The primary UI for Migration Studio is the **React dashboard page** (`/migration-studio`) served by `sbt dashboard`. It connects to the running `sbt migration-studio` server and provides the full editor experience inside the dashboard shell.

The dashboard Migrations page also supports two quick-access modes:

- **Embedded Studio** — inline inside the Migrations workflow
- **Pop-out Studio** — dedicated Studio tab/window

The dashboard stores the Studio URL so teams can point to non-default ports.

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

The studio serves a local HTTP server on port 3335 with:

**Editor routes:**
- `GET /` — Editor page
- `GET /api/events` — Server-Sent Events refresh channel
- `GET /api/schema` — Schema introspection (DB → atlas-data → artifact)
- `GET /api/templates` — Migration template list
- `GET /api/migrations` — Migration files with status
- `POST /api/analyze` — Analyze SQL (operations, risk flags)
- `POST /api/save` — Save migration file (body: `{ sql, description?, filename? }`)
- `POST /api/validate` — Dry run: validate SQL
- `POST /api/apply` — Apply migrations; enforces release gate, writes `studio.apply.log`, returns `snapshotStale` flag

**Adoption / understanding routes:**
- `POST /api/studio/introspect` — Introspect live DB → `studio.schema.snapshot`
- `POST /api/studio/sql-parse` — Parse migration files → `studio.sql.ast`
- `POST /api/studio/intent-sync` — Run confidence sync tool → `studio.intent.sync-report`
- `POST /api/studio/intent-init` — Build intent graph from sync report → `studio.intent.graph`
- `GET /api/studio/intent-graph` — Read current intent graph or `null`
- `GET /api/studio/adopt/status` — Workflow run state
- `POST /api/studio/adopt/start` / `/resume` — Run adoption workflow
- `GET /api/studio/catalog` — Filterable catalog of discovered tools/workflows (`audience`, `mode`, `type`)

**Scaffold routes (generate migration files):**
- `POST /api/studio/scaffold/create-table`
- `POST /api/studio/scaffold/add-column`
- `POST /api/studio/scaffold/add-rls-policy`
- `POST /api/studio/scaffold/add-index`
- `POST /api/studio/scaffold/add-constraint`
- `POST /api/studio/scaffold/add-function`
- `POST /api/studio/scaffold/create-rpc`
- `POST /api/studio/scaffold/create-view`
- `POST /api/studio/greenfield-init`

**Validation routes:**
- `POST /api/studio/rls-check`
- `POST /api/studio/rpc-lint`
- `POST /api/studio/migration-plan`
- `POST /api/studio/migration-lint`
- `POST /api/studio/release-gate`

**Intent graph mutation:**
- `POST /api/studio/intent-graph/entity` — Patch entity managed-status
- `POST /api/studio/endpoint-map` — Derive PostgREST endpoint declarations

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

## Migration Studio Platform

The plugin ships a complete **backend design platform** covering all five layers — Understand → Design → Generate → Validate → Apply. See:

**[Migration Studio Platform →](./plugin-migration-studio-platform)**

Adds: brownfield adoption workflow (`sbt studio-adopt`), visual Schema Builder dashboard page, scaffold commands for tables/columns/policies/indexes/constraints/functions/RPCs/views, validation tools (RLS check, migration lint, RPC lint, migration plan, release gate), interactive Adoption page, greenfield init, intent graph mutation, endpoint mapping, and apply-time audit log.

## Dependencies

Requires `pg` for database schema introspection (optional peer; studio degrades to atlas-data/artifact when DB unreachable).
