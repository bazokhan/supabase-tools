# Supabase Tools

Portable toolkit for local Supabase development. Published as npm packages under `@sbtools`.

## When to Use

Use this skill when the user needs to:
- Start/stop/manage local Supabase Docker services
- Run or create database migrations
- Generate TypeScript types, ERD diagrams, or snapshot the DB schema
- Run SQL tests (against a server or in-memory)
- Serve API documentation (Swagger, ReDoc, SchemaSpy)
- Modify or extend config validation, pre-flight checks, CLI output, or error handling

## Installation

```bash
npm install @sbtools/core
npm install @sbtools/plugin-erd   # etc.
```

## CLI

Entry point: `npx sbt <command>` (runs compiled `packages/core/dist/cli.js`)

Development: `npm run dev` or `tsx packages/core/src/cli.ts <command>`

### Commands

- `start`, `stop`, `restart` — Docker services
- `status` — Service URLs, JWT keys, DB connection string
- `migrate` — Apply SQL migrations
- `snapshot` — Export DB objects to snapshot directory
- `generate-types` — Fetch types from PostgREST
- `generate-erd` — Per-table Mermaid ERD
- `generate-atlas` — Backend Atlas JSON (HTML via plugin-atlas-html)
- `test` — pgTAP tests (live or `--mem` PGlite)
- `docs` — Start Swagger, ReDoc, Atlas, SchemaSpy (plugin-docs-server)
- `migration-audit` — Compare migrations vs DB; report + detail pages (plugin-migration-audit)
- `migration-studio` — Schema-aware migration authoring UI (plugin-migration-studio)
- `init` — Generate config file; appends `.sbt/` to `.gitignore` if missing

## Versioned Artifacts

Plugins produce versioned artifacts under `.sbt/artifacts/<id>/<version>/latest.json`. Used for cross-plugin collaboration (e.g. docs-server consumes `openapi.partial.deno-functions`; migration-audit produces `migration.analysis`). See `docs/architecture/` for registry and contract guide.

## Plugins

Plugins are npm packages or filesystem paths. In config:

```json
{
  "plugins": [
    { "path": "@sbtools/plugin-erd", "config": {} },
    { "path": "./local-plugin", "config": {} }
  ]
}
```

- **npm package** (`@sbtools/plugin-*`) — Node resolves from node_modules
- **filesystem path** — Tried: `dist/index.js`, `index.js`, `index.ts`, `src/index.ts`

## File Layout

```
packages/
├── sdk/           # @sbtools/sdk — shared types, ui, errors
├── core/          # @sbtools/core — CLI, config, plugin loader, commands
│   ├── src/       # TypeScript source
│   ├── dist/      # Compiled output (built)
│   ├── docker/    # Init scripts
│   └── tests/
└── plugin-*/      # @sbtools/plugin-*
```

## Build

```bash
npm run build   # SDK first, then all workspaces
npm run clean   # rimraf dist in all packages
```

## Testing

```bash
npm test
```

Vitest in `packages/sdk`, `packages/core`, and selected plugins. Tests use `@sbtools/sdk` from workspace.

## CLI Verification

Only Docker needs to be running. Run `sbt start` before tests; run `sbt stop` and `sbt docs stop` afterwards.

Run all impacted commands against a consumer project with linked packages and full plugin config. Run `docs stop` last so docs containers stay up until all tests finish.

| Command | Expected |
|---------|----------|
| `sbt help` | Help listing with plugin commands |
| `sbt init` | Config exists or created; `.sbt/` added to `.gitignore` if missing |
| `sbt migration-audit` | Audit summary; writes `migration.analysis` artifact; report + detail pages in docs |
| `sbt migration-studio` | Schema-aware migration authoring UI at http://localhost:3335 |
| `sbt edge-functions` | Edge function table; writes `openapi.partial.deno-functions` artifact |
| `sbt frontend-usage` | Components/tables report; writes `frontend.usage` artifact |
| `sbt status` | Service URLs, keys; plugin status lines |
| `sbt generate-atlas` | Backend atlas JSON; plugin contributions |
| `sbt depgraph` | HTML + Mermaid graphs; writes `depgraph.graph` artifact |
| `sbt atlas-html` | Backend atlas HTML |
| `sbt docs swagger` | OpenAPI merge; artifact consumed: `openapi.partial.deno-functions (artifact): N path(s) merged`; Swagger container started |
| `sbt generate-erd` | ERD diagrams per table |
| `sbt generate-types` | TypeScript types |
| `sbt migrate` | Migrations applied or up to date |
| `sbt snapshot` | DB objects exported to snapshot dir |
| `sbt test` | pgTAP tests (may fail on project-specific fixtures) |
| `sbt docs stop` | Docs containers stopped |

Artifacts written: `migration.analysis`, `openapi.partial.deno-functions`, `depgraph.graph`, `frontend.usage` in `.sbt/artifacts/<id>/1.0.0/latest.json`.
