# supabase-tools

Portable toolkit for local Supabase development. Install via npm, run with `npx sbt`. Designed to be used directly by developers and by AI agents (Claude, Cursor, Copilot) via its HTTP tool surface.

## Quick Start

```bash
npm install @sbtools/core @sbtools/plugin-migration-studio

# Initialize config
npx sbt init

# Start Supabase services
npx sbt start

# Start the dashboard (port 3400) + migration studio (port 3335)
npx sbt dashboard
```

## Core Commands

| Command | Description |
|---|---|
| `start` | Start Supabase Docker stack |
| `stop` | Stop Supabase stack |
| `restart` | Restart Supabase stack |
| `status` | Show service URLs, keys, connection info |
| `migrate` | Apply SQL migrations from `supabase/migrations/` |
| `snapshot` | Export DB objects to filesystem |
| `watch` | Watch DB/files, keep artifacts fresh |
| `dashboard` | Start dashboard UI on port 3400 |
| `generate-atlas` | Generate Backend Atlas data (JSON) |
| `init` | Create `supabase-tools.config.json` |

## Migration Studio

The migration studio (plugin) runs a local HTTP server on port 3335 that exposes all tools via both CLI and HTTP. This makes it usable by AI agents as structured tool calls.

```bash
# Start studio server
npx sbt migration-studio

# Or call individual tools directly
npx sbt studio-introspect        # snapshot live DB schema
npx sbt studio-intent-init       # build intent graph
npx sbt studio-release-gate      # pass/fail validation before apply
```

### Studio Tools (21 tools)

**Understand your backend:**

| Tool | Description |
|---|---|
| `studio-introspect` | Query live DB → typed schema snapshot |
| `studio-sql-parse` | Parse migration files → SQL AST |
| `studio-intent-sync` | Score confidence: DB vs SQL (0.0–1.0 per entity) |
| `studio-intent-init` | Build intent graph with managed/assisted/opaque classification |

**Generate migrations:**

| Tool | Description |
|---|---|
| `studio-create-table` | CREATE TABLE migration |
| `studio-add-column` | ADD COLUMN migration |
| `studio-add-index` | CREATE INDEX migration |
| `studio-add-constraint` | ALTER TABLE ADD CONSTRAINT |
| `studio-add-rls-policy` | CREATE POLICY migration |
| `studio-add-function` | CREATE FUNCTION migration |
| `studio-create-rpc` | CREATE RPC (public schema) |
| `studio-create-view` | CREATE OR REPLACE VIEW |

**Validate before applying:**

| Tool | Description |
|---|---|
| `studio-rls-check` | RLS coverage audit per entity |
| `studio-migration-lint` | Risk flags, naming violations, lock-safety |
| `studio-rpc-lint` | Function security audit (search_path, authz) |
| `studio-migration-plan` | Ordered change plan with change-class annotations |
| `studio-release-gate` | Aggregated pass/fail gate — run before `migrate` |

**Graph & mapping:**

| Tool | Description |
|---|---|
| `studio-intent-patch` | Mutate entity managed-status in the intent graph |
| `studio-endpoint-map` | Map PostgREST endpoints from intent graph |
| `studio-greenfield-init` | Initialize intent graph for a new project |

### Studio Workflows

| Workflow | Steps |
|---|---|
| `adopt-backend` | introspect → sql-parse → intent-sync → intent-init (with checkpoints) |
| `release-check` | migration-plan → rls-check → rpc-lint → release-gate |
| `create-table` | create-table → sql-parse |
| `add-rls-policy` | add-rls-policy → rls-check |

### HTTP API (port 3335)

Every tool is also available over HTTP. LLMs can discover tools via:

```
GET  /api/studio/catalog              # filterable tool/workflow list
POST /api/studio/introspect           # run any tool
GET  /api/studio/intent-graph         # current intent graph
POST /api/apply                       # apply pending migrations (respects release gate)
```

Filter the catalog by audience and control mode:
```
GET /api/studio/catalog?audience=backend-dev&mode=managed&type=tools
```

### Using with AI Agents

The studio server is designed for programmatic use. An AI agent can:

1. `GET /api/studio/catalog` — discover what's available
2. `POST /api/studio/introspect` — understand the current DB state
3. `POST /api/studio/intent-init` — build an intent graph
4. `POST /api/studio/create-table` (or any scaffold tool) — generate migration SQL
5. `POST /api/studio/release-gate` — validate before applying
6. `POST /api/apply` — apply if gate passes

## Plugin Commands

| Command | Plugin | Description |
|---|---|---|
| `generate-erd` | plugin-erd | Mermaid ERD diagrams per table |
| `generate-types` | plugin-typegen | TypeScript types from DB schema |
| `test` | plugin-db-test | pgTAP tests (live or `--mem` PGlite) |
| `edge-functions` | plugin-deno-functions | List/document edge functions |
| `depgraph` | plugin-depgraph | Dependency graph (HTML + Mermaid) |
| `frontend-usage` | plugin-frontend-usage | Scan frontend for Supabase SDK usage |
| `logs` | plugin-logs | Docker logs, pg_stat_statements |
| `migration-audit` | plugin-migration-audit | Migration drift detection |
| `scaffold-plugin` | plugin-scaffold | Scaffold new plugins |

## All Plugins

| Package | Description |
|---|---|
| `@sbtools/plugin-migration-studio` | Migration authoring, intent graph, release gate, HTTP tool surface |
| `@sbtools/plugin-migration-audit` | Migration drift detection vs DB tracking table |
| `@sbtools/plugin-depgraph` | TypeScript function/table dependency graph |
| `@sbtools/plugin-erd` | Mermaid ERD diagrams |
| `@sbtools/plugin-typegen` | TypeScript type generation from Supabase schema |
| `@sbtools/plugin-db-test` | pgTAP test runner via PGlite |
| `@sbtools/plugin-logs` | Docker log tailing + pg_stat_statements viewer |
| `@sbtools/plugin-deno-functions` | Edge function documentation + OpenAPI spec |
| `@sbtools/plugin-frontend-usage` | Frontend Supabase SDK usage scanner |
| `@sbtools/plugin-scaffold` | Scaffold new plugin boilerplate |

Full docs: [bazokhan.github.io/supabase-tools](https://bazokhan.github.io/supabase-tools/)

## Configuration

Run `npx sbt init` to create `supabase-tools.config.json`. Override DB URL via `DATABASE_URL`, `SUPABASE_DB_URL`, or `POSTGRES_URL`.

## Error Handling

Structured errors: `ConfigError`, `DatabaseError`, `SnapshotError`, `PluginError`, `SbtError`. Set `SBT_DEBUG=1` for stack traces.

## Development

```bash
npm run build    # sdk → ui-web → all packages
npm test         # vitest across all packages
```

## Requirements

- Node.js 18+
- Docker (for `start`, `migrate`, and Docker-based plugins)

## License

MIT
