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
- `init` — Generate config file

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

Vitest in `packages/core`. Tests use `@sbtools/sdk` from workspace.
