---
description: List of available plugins, installation, and activation in supabase-tools.config.json.
---

# Plugins

Plugins extend supabase-tools with additional commands. Install a plugin via npm and add it to `supabase-tools.config.json` to use its commands.

## Available Plugins

| Plugin | npm | Description |
|--------|-----|-------------|
| [plugin-db-test](/plugins/plugin-db-test) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-db-test.svg)](https://www.npmjs.com/package/@sbtools/plugin-db-test) | pgTAP test runner (live + PGlite) |
| [plugin-deno-functions](/plugins/plugin-deno-functions) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-deno-functions.svg)](https://www.npmjs.com/package/@sbtools/plugin-deno-functions) | Edge function documentation |
| [plugin-depgraph](/plugins/plugin-depgraph) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-depgraph.svg)](https://www.npmjs.com/package/@sbtools/plugin-depgraph) | Dependency graph visualization |
| [plugin-erd](/plugins/plugin-erd) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-erd.svg)](https://www.npmjs.com/package/@sbtools/plugin-erd) | Mermaid ERD diagram generation |
| [plugin-frontend-usage](/plugins/plugin-frontend-usage) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-frontend-usage.svg)](https://www.npmjs.com/package/@sbtools/plugin-frontend-usage) | Frontend Supabase SDK usage scanner |
| [plugin-logs](/plugins/plugin-logs) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-logs.svg)](https://www.npmjs.com/package/@sbtools/plugin-logs) | Docker logs, pg_stat_statements |
| [plugin-migration-audit](/plugins/plugin-migration-audit) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-migration-audit.svg)](https://www.npmjs.com/package/@sbtools/plugin-migration-audit) | Migration file vs DB tracking — drift detection |
| [plugin-migration-studio](/plugins/plugin-migration-studio) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-migration-studio.svg)](https://www.npmjs.com/package/@sbtools/plugin-migration-studio) | Migration authoring UI — create, analyze, apply |
| [plugin-scaffold](/plugins/plugin-scaffold) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-scaffold.svg)](https://www.npmjs.com/package/@sbtools/plugin-scaffold) | Scaffold new plugins |
| [plugin-typegen](/plugins/plugin-typegen) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-typegen.svg)](https://www.npmjs.com/package/@sbtools/plugin-typegen) | TypeScript type generation |

The `docs` command (Swagger UI, ReDoc, SchemaSpy) and the `dashboard` command (React SPA) are **built into core** — no plugin required.

## Installation

```bash
# Example: install ERD plugin
npm install @sbtools/plugin-erd
```

## Activation

Add to `supabase-tools.config.json`:

```json
{
  "plugins": [
    { "path": "@sbtools/plugin-erd", "config": {} }
  ]
}
```

Use `"path": "@sbtools/plugin-<name>"` for npm packages, or a relative path for local plugins.
