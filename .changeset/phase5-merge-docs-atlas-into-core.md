---
"@sbtools/core": minor
---

# Phase 5: Merge plugin-docs-server and plugin-atlas-html into core

**Breaking**: Remove `@sbtools/plugin-docs-server` and `@sbtools/plugin-atlas-html` from your `supabase-tools.config.json` plugins array. The `docs` and `atlas-html` commands are now built into `@sbtools/core`.

## Core changes

- **docs command**: Moved from plugin-docs-server into core. Starts Swagger UI, ReDoc, Backend Atlas, and SchemaSpy via Docker Compose. No plugin required.
- **atlas-html command**: Moved from plugin-atlas-html into core. Generates Backend Atlas HTML from `backend-atlas-data.json`. No plugin required.
- **buildCoreContext()**: Core commands that need plugin access (e.g. docs for OpenAPI merge, atlas-html for UI contributions) receive a context with `siblingPlugins`.
- **Command registry**: `run` now accepts optional second parameter `ctx` for commands that need plugin integration.

## Migration

1. Remove from `supabase-tools.config.json` plugins:
   - `{ "path": "@sbtools/plugin-docs-server" }`
   - `{ "path": "@sbtools/plugin-atlas-html" }`
2. Uninstall (optional): `npm uninstall @sbtools/plugin-docs-server @sbtools/plugin-atlas-html`
3. Commands `sbt docs` and `sbt atlas-html` continue to work identically.

Package count: 14 → 12 (sdk + core + 10 plugins).
