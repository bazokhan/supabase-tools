---
description: Portable toolkit for local Supabase development — Docker services, migrations, ERD, dependency graphs, dashboard, and docs. CLI via npx sbt.
---

# supabase-tools

[![GitHub stars](https://img.shields.io/github/stars/bazokhan/supabase-tools?style=social)](https://github.com/bazokhan/supabase-tools)

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
- **Dashboard** — React SPA with ERD, depgraph, logs, migrations, and a Commands runner (`sbt dashboard`, port 3400)
- **ERD** — Mermaid diagram generation per table (via `plugin-erd`)
- **Tests** — pgTAP + PGlite in-memory runner (via `plugin-db-test`)
- **Docs** — Swagger UI, ReDoc, SchemaSpy (via built-in `docs` command)

## Core Commands

| Command | Description |
|---------|-------------|
| `start` | Start Supabase stack (DB, API, etc.) |
| `stop` | Stop Supabase stack |
| `restart` | Restart Supabase stack |
| `status` | Show service URLs and connection info |
| `migrate` | Apply SQL migrations |
| `snapshot` | Export DB objects to filesystem |
| `generate-atlas` | Generate Backend Atlas data (JSON) |
| `dashboard` | Start React dashboard UI (port 3400) |
| `docs` | Start Swagger UI / ReDoc / SchemaSpy |
| `init` | Generate config file |

Plugin commands (generate-erd, test, etc.) — [Plugins](/plugins/).

All commands: `npx sbt <command>`

## Next Steps

- [Getting Started](/getting-started) — Installation and setup
- [Configuration](/configuration) — Config file reference
- [Plugins](/plugins/) — Available plugins and how to add them
