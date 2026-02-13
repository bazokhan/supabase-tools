# supabase-tools

Portable toolkit for local Supabase development without the Supabase CLI. Install via npm and run with `npx sbt`.

## Quick Start

```bash
# Install core CLI
npm install @sbtools/core

# Install plugins (example: ERD generation)
npm install @sbtools/plugin-erd

# Add to supabase-tools.config.json
{
  "plugins": [{ "path": "@sbtools/plugin-erd", "config": {} }]
}

# Start services
npx sbt start

# Generate ERD diagrams
npx sbt generate-erd
```

## Commands

| Command | Description |
|---------|-------------|
| `start` | Start Supabase stack (DB, API, etc.) |
| `stop` | Stop main Supabase stack (run `sbt docs stop` for documentation containers; requires plugin-docs-server) |
| `restart` | Restart main Supabase stack |
| `status` | Show service URLs, keys, connection info |
| `migrate` | Apply SQL migrations from `supabase/migrations/` |
| `snapshot` | Export DB objects to filesystem |
| `generate-types` | Generate TypeScript types from the DB schema |
| `generate-erd` | Generate Mermaid ERD diagrams per table |
| `generate-atlas` | Generate Backend Atlas data (JSON) |
| `test` | Run SQL tests against the running DB |
| `test --mem` | Run SQL tests in-memory with PGlite |
| `docs` | Start all documentation services (Swagger, ReDoc, Atlas, SchemaSpy) — requires plugin-docs-server |
| `docs swagger` | Start Swagger UI only |
| `docs redoc` | Start ReDoc only |
| `docs atlas` | Start Backend Atlas only |
| `docs schemaspy` | Start SchemaSpy only |
| `docs stop` | Stop all documentation containers |
| `init` | Generate `supabase-tools.config.json` with defaults |

All commands: `npx sbt <command>`

## Configuration

Run `init` to create `supabase-tools.config.json` at project root. Override DB URL via `DATABASE_URL`, `SUPABASE_DB_URL`, or `POSTGRES_URL`. Set `api.url` for external Supabase instances.

## Error Handling

Structured errors with codes: `ConfigError`, `DatabaseError`, `SnapshotError`, `PluginError`, `SbtError`. Set `SBT_DEBUG=1` for stack traces.

## Requirements

- Node.js 18+
- Docker (for `start`, `migrate`, `docs`)

## Documentation

Full docs: [docs site](https://bazokhan.github.io/supabase-tools/) (or run `npm run docs:dev` for local dev).

## Plugins

| Plugin | npm | Description |
|--------|-----|-------------|
| plugin-erd | `@sbtools/plugin-erd` | Mermaid ERD diagrams |
| plugin-typegen | `@sbtools/plugin-typegen` | TypeScript type generation |
| plugin-atlas-html | `@sbtools/plugin-atlas-html` | Backend Atlas HTML |
| plugin-db-test | `@sbtools/plugin-db-test` | pgTAP + PGlite test runner |
| plugin-deno-functions | `@sbtools/plugin-deno-functions` | Edge function docs |
| plugin-depgraph | `@sbtools/plugin-depgraph` | Dependency graph visualization |
| plugin-docs-server | `@sbtools/plugin-docs-server` | Swagger UI, ReDoc |
| plugin-frontend-usage | `@sbtools/plugin-frontend-usage` | Frontend SDK usage scanner |
| plugin-logs | `@sbtools/plugin-logs` | Docker logs, pg_stat_statements |
| plugin-scaffold | `@sbtools/plugin-scaffold` | Scaffold new plugins |

## Docs Workflow

Requires `plugin-docs-server` in your config. Each docs service can run independently with its own preflight:

| To run only... | Prerequisites | Command |
|----------------|---------------|---------|
| Swagger UI | Docker, openapi-spec (auto-fetched or placeholder) | `sbt docs swagger` |
| ReDoc | Same as Swagger | `sbt docs redoc` |
| Backend Atlas | `sbt generate-atlas` + `sbt atlas-html` | `sbt docs atlas` |
| SchemaSpy | Docker + DB running | `sbt docs schemaspy` |
| All services | All of the above | `sbt docs all` or `sbt docs` |

Full sequence for all docs:

1. `sbt start`
2. `sbt snapshot`
3. `sbt generate-atlas`
4. `sbt atlas-html`
5. `sbt generate-erd`
6. `sbt docs all`

## License

MIT
