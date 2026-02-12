---
description: Portable toolkit for local Supabase development — Docker services, migrations, typegen, ERD, tests, and docs. CLI via npx sbt.
---

# supabase-tools

Portable toolkit for local Supabase development without the Supabase CLI.

## Quick Start

```bash
# Install core CLI
npm install @sbtools/core

# Install a plugin (example: ERD generation)
npm install @sbtools/plugin-erd

# Add to supabase-tools.config.json
# Run commands
npx sbt help
```

**Packages:** [@sbtools/core](https://www.npmjs.com/package/@sbtools/core) · [All packages on npm](https://www.npmjs.com/org/sbtools)

## What's Included

- **Docker services** — Start/stop Supabase stack locally
- **Migrations** — Apply SQL from `supabase/migrations/`
- **Snapshot** — Export DB schema to filesystem
- **ERD** — Mermaid diagram generation per table
- **Tests** — pgTAP + PGlite in-memory runner
- **Docs** — Swagger UI, ReDoc, SchemaSpy, Backend Atlas

## Commands

| Command | Description |
|---------|-------------|
| `start` | Start all Supabase Docker services |
| `stop` | Stop all services |
| `status` | Show service URLs and connection info |
| `migrate` | Apply SQL migrations |
| `snapshot` | Export DB objects to filesystem |
| `generate-types` | Generate TypeScript types from DB |
| `generate-erd` | Generate Mermaid ERD diagrams |
| `generate-atlas` | Generate Backend Atlas HTML |
| `test` | Run SQL tests (pgTAP) |
| `docs` | Start API documentation services |
| `init` | Generate config file |

All commands: `npx sbt <command>`

## Next Steps

- [Getting Started](/getting-started) — Installation and setup
- [Configuration](/configuration) — Config file reference
- [Plugins](/plugins/) — Available plugins and how to add them
