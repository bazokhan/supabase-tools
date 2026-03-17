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
| `watch [--scope migration]` | Watch DB/files and keep migration artifacts fresh (`migration-audit --no-open`) |
| `dashboard [--port N]` | Start unified dashboard UI (React) with APIs for atlas data, live logs, and file browsing |

`migrate` env vars:

- `MIGRATION_BASELINE=1` — record all migrations as applied without running them
- `MIGRATION_REAPPLY=1` — force reapply even if DB has existing tables

`watch` options:

- `--scope migration` — phase-1 scope (default)
- `--debounce-ms N` — debounce bursty events (default: `1500`)
- `--no-db-hooks` — skip DB trigger/event-trigger helper install
- `--verbose` — print event payloads

### Generation

| Command | Description |
|---------|-------------|
| `generate-atlas` | Generate Backend Atlas data (`.sbt/docs/backend-atlas-data.json` by default) |
| `init` | Generate `supabase-tools.config.json` with defaults |

### Other

| Command | Description |
|---------|-------------|
| `help` / `-h` / `--help` | Show all available commands |

`dashboard` options:

- `--port N` — listen on custom port (default: 3400)

`dashboard` API routes:

- `GET /api/atlas-data` — Backend Atlas JSON
- `GET /api/dashboard-config` — Combined dashboard section definitions (core + plugins)
- `GET /api/commands` — All registered commands (core + plugin) with category metadata
- `GET /api/run/stream?command=...` — SSE: spawn `sbt <command>` and stream stdout/stderr
- `GET /api/logs/services` — Current Docker service statuses
- `GET /api/logs/stream?services=...` — Live SSE log stream from Docker
- `GET /api/fs/list?scope=...&path=...` — Safe file listing (`snapshot`, `migrations`, `docs`, `project`)
- `GET /api/fs/file?scope=...&path=...` — Safe file content view in browser

## Plugin Commands

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

### docs (core)

| Command | Description |
|---------|-------------|
| `docs` / `docs all` | Start all doc services |
| `docs swagger` | Swagger UI (port 8081) |
| `docs redoc` | ReDoc (port 8082) |
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
| `migration-studio` | Start schema-aware migration authoring UI at `http://localhost:3335` |
| `migration-studio --port N` | Use custom port |
| `migration-studio --restart` | Kill existing process on port, then start (auto-retry on port conflict) |

Requires DB for schema introspection (falls back to atlas-data/artifact when unreachable).

#### Brownfield Adoption

| Command | Description |
|---------|-------------|
| `studio-introspect` | Query live DB → `studio.schema.snapshot` artifact |
| `studio-sql-parse` | Parse migration files → `studio.sql.ast` artifact |
| `studio-adopt` | Full adoption workflow (introspect → sql-parse → review → intent-sync → approve → intent-init) |
| `studio-catalog [--audience <backend-dev\|business\|mixed>] [--mode <managed\|assisted\|loose>] [--type <tools\|workflows\|all>]` | List discovered tools/workflows from catalog with persona/control-mode filters |
| `studio-intent-patch --entity <id> --action <exclude\|set-status> [--status <managed\|assisted>]` | Mutate a single entity's managed-status in the intent graph |
| `studio-endpoint-map` | Derive PostgREST `EndpointNode` declarations for all managed entities/functions |

#### Scaffold Tools (Generate Layer)

| Command | Description |
|---------|-------------|
| `studio-create-table --schema <s> --name <n> [--columns <json>] [--no-rls]` | Generate `CREATE TABLE` migration |
| `studio-add-column --entity <schema.table> --name <col> --type <type> [--nullable] [--default <val>]` | Generate `ALTER TABLE ... ADD COLUMN` migration (requires intent graph) |
| `studio-add-rls-policy --entity <id> --name <n> --command <SELECT\|INSERT\|...> --roles <r>` | Generate `CREATE POLICY` migration |
| `studio-add-index --entity <id> --name <n> --columns <cols> [--unique] [--method <btree\|...>]` | Generate `CREATE INDEX` migration |
| `studio-add-constraint --entity <id> --name <n> --type <fk\|unique\|check> [--options...]` | Generate `ALTER TABLE ... ADD CONSTRAINT` migration |
| `studio-add-function --schema <s> --name <n> --returns <type> --language <sql\|plpgsql> --body-file <path>` | Generate `CREATE OR REPLACE FUNCTION` migration |
| `studio-create-rpc --name <n> --returns <type> --language <sql\|plpgsql> --body-file <path>` | Same as add-function, forces `schema: public` |
| `studio-create-view --schema <s> --name <n> --query "SELECT ..."` | Generate `CREATE OR REPLACE VIEW` migration |
| `studio-greenfield-init` | Initialize an empty intent graph for a new project (no DB introspection needed) |

#### Validation Tools (Validate Layer)

| Command | Description |
|---------|-------------|
| `studio-rls-check` | RLS coverage check — gap analysis per managed entity → `studio.rls.plan` + `studio.rls.report` |
| `studio-rpc-lint` | Function security audit (DEFINER/search_path/exposure) → `studio.rpc.plan` |
| `studio-migration-plan` | Intent graph diff → ordered SQL change plan → `studio.migration.plan` |
| `studio-lint` | Migration file lint (destructive ops, naming, lock safety) → `studio.migration.lint` |
| `studio-migration-lint` | Alias for `studio-lint` |
| `studio-release-gate` | Aggregate RLS/RPC/lint findings → pass/fail → `studio.release.gate` |
| `studio-release-check` | One-shot: runs full release-check workflow (no server needed). Exits 0 on pass, 1 on fail. `--json` for raw output. |

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
