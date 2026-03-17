---
description: Install @sbtools/core and plugins, create supabase-tools.config.json, and run your first commands.
---

# Getting Started

## Installation

```bash
# Install the core CLI + migration studio (flagship plugin)
npm install @sbtools/core @sbtools/plugin-migration-studio

# Optional additional plugins
npm install @sbtools/plugin-erd
npm install @sbtools/plugin-migration-audit
npm install @sbtools/plugin-logs
```

**npm:** [@sbtools/core](https://www.npmjs.com/package/@sbtools/core) · [@sbtools/plugin-migration-studio](https://www.npmjs.com/package/@sbtools/plugin-migration-studio) · [All packages](https://www.npmjs.com/org/sbtools)

## Configuration

Run `npx sbt init` to create `supabase-tools.config.json`, or create it manually:

```json
{
  "plugins": [
    { "path": "@sbtools/plugin-migration-studio", "config": {} },
    { "path": "@sbtools/plugin-migration-audit", "config": {} }
  ]
}
```

You can use either:
- **npm package name** — `"path": "@sbtools/plugin-migration-studio"` (resolved from node_modules)
- **filesystem path** — `"path": "./local-plugins/my-plugin"` (for local development)

## Quick Start (Human)

```bash
# Start Supabase Docker services
npx sbt start

# Check service URLs and connection info
npx sbt status

# Start the dashboard UI (port 3400)
npx sbt dashboard

# Start the migration studio server (port 3335)
npx sbt migration-studio

# Run pending migrations
npx sbt migrate
```

## Quick Start (AI Agent / LLM)

The migration studio exposes a typed HTTP tool surface that AI agents can call directly.

```bash
# Start the studio server
npx sbt migration-studio
```

Then the agent can orient itself in one call:

```
GET http://localhost:3335/api/studio/llm-context
```

This returns the current intent graph state, artifact freshness, full tool catalog with descriptions, and migration count — everything needed to understand the project without exploring files.

**Typical agent workflow:**

```
# 1. Understand the current backend
POST /api/studio/introspect       → live DB schema → studio.schema.snapshot
POST /api/studio/sql-parse        → migration SQL AST → studio.sql.ast
POST /api/studio/intent-init      → build intent graph → studio.intent.graph

# 2. Generate a migration
POST /api/studio/create-table     → CREATE TABLE SQL → saved to migrations/

# 3. Validate before applying
POST /api/studio/release-gate     → { status: 'pass' | 'fail', reasons: [] }

# 4. Apply if safe
POST /api/apply                   → runs migrations (blocked if gate fails)
```

Discover all available tools:

```
GET /api/studio/catalog?audience=backend-dev&mode=managed&type=tools
```

## Requirements

- Node.js 18+
- Docker (for `start`, `migrate`, and Docker-based plugins)

## Next Steps

- [CLI Reference](./cli-reference) — All commands and flags
- [Configuration](./configuration) — Full config schema
- [Migration Studio](./plugins/plugin-migration-studio) — Complete tool reference
- [Writing Plugins](./writing-plugins) — Extend with your own plugin
