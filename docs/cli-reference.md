---
description: Complete command reference for sbt — core commands, plugin commands, flags, and environment variables.
---

# CLI Reference

All commands: `npx sbt <command> [options]`

Run `npx sbt help` to list available commands (including installed plugins).

## Core Commands

### Docker

| Command | Description |
|---------|-------------|
| `start` | Start Supabase Docker stack |
| `stop` | Stop all services |
| `restart` | Restart all services |
| `status` | Show service URLs, keys, and connection info |

### Database

| Command | Description |
|---------|-------------|
| `migrate` | Apply SQL migrations from `supabase/migrations/` |
| `snapshot [schema...] [all]` | Export DB objects (functions, views, triggers, policies, types, enums) to filesystem |

`migrate` env vars:

- `MIGRATION_BASELINE=1` — record all migrations as applied without running them
- `MIGRATION_REAPPLY=1` — force reapply even if DB has existing tables

### Generation

| Command | Description |
|---------|-------------|
| `generate-atlas` | Generate Backend Atlas data (`docs/backend-atlas-data.json`) |
| `init` | Generate `supabase-tools.config.json` with defaults |

### Other

| Command | Description |
|---------|-------------|
| `help` / `-h` / `--help` | Show all available commands |

## Plugin Commands

### plugin-atlas-html

| Command | Description |
|---------|-------------|
| `atlas-html` | Generate Backend Atlas HTML visualization |

Requires `generate-atlas` first.

### plugin-db-test

| Command | Description |
|---------|-------------|
| `test` | Run pgTAP database tests against live DB |
| `test --mem` | Run tests in-memory using PGlite |

Config: `testsDir`, `migrationsDir`

### plugin-deno-functions

| Command | Description |
|---------|-------------|
| `edge-functions` | List discovered edge functions |
| `edge-functions --brief` | Summary table only |
| `edge-functions --json` | Raw JSON output |
| `edge-functions --openapi` | Generate OpenAPI spec at `docs/edge-functions-openapi.json` |

Config: `baseUrl`, `configTomlPath`

### plugin-depgraph

| Command | Description |
|---------|-------------|
| `depgraph` | Generate HTML + Mermaid dependency graph |
| `depgraph --html` | HTML only |
| `depgraph --mermaid` | Mermaid only |
| `depgraph --json` | Raw JSON to stdout |
| `depgraph --no-open` | Skip opening in browser |

Requires `generate-atlas` first. Config: `typesFilePath`

### plugin-docs-server

| Command | Description |
|---------|-------------|
| `docs` / `docs all` | Start all doc services |
| `docs swagger` | Swagger UI (port 8081) |
| `docs redoc` | ReDoc (port 8082) |
| `docs atlas` | Backend Atlas (port 8083/atlas/) |
| `docs schemaspy` | SchemaSpy (port 8083/schemaspy/) |
| `docs stop` | Stop all docs containers |

### plugin-erd

| Command | Description |
|---------|-------------|
| `generate-erd` | Generate Mermaid ERD per public table |

Config: `erdOutput`, `displayColumns`

### plugin-frontend-usage

| Command | Description |
|---------|-------------|
| `frontend-usage` | Scan frontend for Supabase SDK usage, generate HTML report |
| `frontend-usage --json` | Raw JSON output |
| `frontend-usage --no-open` | Skip opening in browser |

Config: `scanPaths`

### plugin-migration-audit

| Command | Description |
|---------|-------------|
| `migration-audit` | Compare disk migrations vs DB; CLI summary + HTML report + detail pages |
| `migration-audit --json` | Output raw audit JSON |
| `migration-audit --html` | Generate HTML only |
| `migration-audit --no-open` | Skip opening browser |

Produces `migration.analysis` artifact. Detail pages at `{docsOutput}/migration-audit/<slug>.html`.

### plugin-migration-studio

| Command | Description |
|---------|-------------|
| `migration-studio` | Start schema-aware migration authoring UI at http://localhost:3335 |
| `migration-studio --port N` | Use custom port |
| `migration-studio --restart` | Kill existing process on port, then start (auto-retry on port conflict) |

Requires DB for schema introspection (falls back to atlas-data/artifact when unreachable).

### plugin-logs

| Command | Description |
|---------|-------------|
| `logs` | Tail all running services |
| `logs <service>` | Tail specific service |
| `logs --list` | List services with running/stopped status |
| `logs --tail N` | Number of historical lines (default: 100) |
| `logs --no-color` | Disable ANSI colors |
| `logs --timestamps` | Show Docker timestamps |
| `logs pg-stats` | Query performance stats |
| `logs pg-stats --slow` | Top 20 by mean execution time |
| `logs pg-stats --frequent` | Top 20 by call count |
| `logs pg-stats --reset` | Reset pg_stat_statements |
| `logs pg-stats --json` | Raw JSON output |
| `logs viewer` | Start HTML log viewer (default port 3333) |
| `logs viewer --port N` | Custom viewer port |

Config: `viewerPort`, `tailLines`, `dbContainer`

### plugin-scaffold

| Command | Description |
|---------|-------------|
| `scaffold-plugin <name>` | Create internal plugin in `packages/` |
| `scaffold-plugin <name> --external` | Create external plugin at project root |
| `scaffold-plugin <name> --hooks` | Include Atlas/status/OpenAPI hook stubs |

### plugin-typegen

| Command | Description |
|---------|-------------|
| `generate-types` | Generate TypeScript types from running DB |

Config: `typesOutput`. Env: `SUPABASE_TYPES_SCHEMAS` (comma-separated schemas).

## Environment Variables

**Database connection** (checked in order):

1. `DATABASE_URL`
2. `SUPABASE_DB_URL`
3. `POSTGRES_URL`
4. Falls back to `db.url` in config

**Debug mode:**

- `SBT_DEBUG=1` — verbose output for diagnosing issues
