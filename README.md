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

### Core

| Command | Description |
|---------|-------------|
| `start` | Start Supabase stack |
| `stop` | Stop Supabase stack |
| `restart` | Restart Supabase stack |
| `status` | Show service URLs, keys, connection info |
| `migrate` | Apply SQL migrations from `supabase/migrations/` |
| `snapshot` | Export DB objects to filesystem |
| `watch` | Watch DB/files and keep artifacts fresh |
| `dashboard` | Start modern dashboard UI (overview, migrations, depgraph, live logs, frontend usage) |
| `generate-atlas` | Generate Backend Atlas data (JSON) |
| `atlas-html` | Generate Backend Atlas HTML visualization |
| `docs` | Start documentation services (Swagger, ReDoc, Atlas, SchemaSpy) |
| `init` | Generate `supabase-tools.config.json` with defaults |

### Plugin Commands

| Command | Plugin | Description |
|---------|--------|-------------|
| `generate-erd` | plugin-erd | Mermaid ERD diagrams per table |
| `generate-types` | plugin-typegen | TypeScript types from DB schema |
| `test` | plugin-db-test | pgTAP tests (live or `--mem` PGlite) |
| `edge-functions` | plugin-deno-functions | List/document edge functions |
| `depgraph` | plugin-depgraph | Dependency graph (HTML + Mermaid) |
| `frontend-usage` | plugin-frontend-usage | Scan frontend for SDK usage |
| `logs` | plugin-logs | Docker logs, pg_stat_statements |
| `migration-audit` | plugin-migration-audit | Migration drift detection |
| `migration-studio` | plugin-migration-studio | Migration authoring UI |
| `scaffold-plugin` | plugin-scaffold | Scaffold new plugins |

Full reference: [documentation](https://bazokhan.github.io/supabase-tools/plugins/).

All commands: `npx sbt <command>`

## Configuration

Run `init` to create `supabase-tools.config.json` at project root. Override DB URL via `DATABASE_URL`, `SUPABASE_DB_URL`, or `POSTGRES_URL`. Set `api.url` for external Supabase instances.

## Error Handling

Structured errors with codes: `ConfigError`, `DatabaseError`, `SnapshotError`, `PluginError`, `SbtError`. Set `SBT_DEBUG=1` for stack traces.

## Development

```bash
npm run build           # Build SDK first, then all workspaces
npm test                # Run all tests (199 tests across 9 suites)
npm run lint:conventions  # Check project conventions (advisory warnings)
```

## Requirements

- Node.js 18+
- Docker (for `start`, `migrate`, and Docker-based plugins)

## Documentation

Full docs: [docs site](https://bazokhan.github.io/supabase-tools/) (or run `npm run docs:dev` for local dev).

## Plugins

| Plugin | npm | Description |
|--------|-----|-------------|
| plugin-db-test | `@sbtools/plugin-db-test` | pgTAP + PGlite test runner |
| plugin-deno-functions | `@sbtools/plugin-deno-functions` | Edge function docs + OpenAPI |
| plugin-depgraph | `@sbtools/plugin-depgraph` | Dependency graph visualization |
| plugin-erd | `@sbtools/plugin-erd` | Mermaid ERD diagrams |
| plugin-frontend-usage | `@sbtools/plugin-frontend-usage` | Frontend SDK usage scanner |
| plugin-logs | `@sbtools/plugin-logs` | Docker logs, pg_stat_statements |
| plugin-migration-audit | `@sbtools/plugin-migration-audit` | Migration drift detection |
| plugin-migration-studio | `@sbtools/plugin-migration-studio` | Migration authoring UI |
| plugin-scaffold | `@sbtools/plugin-scaffold` | Scaffold new plugins |
| plugin-typegen | `@sbtools/plugin-typegen` | TypeScript type generation |

> **Note:** `@sbtools/plugin-atlas-html` and `@sbtools/plugin-docs-server` have been merged into `@sbtools/core`. The `atlas-html` and `docs` commands are now built-in.

## License

MIT
