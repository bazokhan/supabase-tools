---
description: List of available plugins, installation, and activation in supabase-tools.config.json.
---

# Plugins

Plugins extend supabase-tools with additional commands and integrations. Install via npm and add to `supabase-tools.config.json`.

## Available Plugins

| Plugin | npm | Description |
|--------|-----|-------------|
| [plugin-atlas-html](/plugins/plugin-atlas-html) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-atlas-html.svg)](https://www.npmjs.com/package/@sbtools/plugin-atlas-html) | Backend Atlas HTML visualization |
| [plugin-db-test](/plugins/plugin-db-test) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-db-test.svg)](https://www.npmjs.com/package/@sbtools/plugin-db-test) | pgTAP test runner (live + PGlite) |
| [plugin-deno-functions](/plugins/plugin-deno-functions) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-deno-functions.svg)](https://www.npmjs.com/package/@sbtools/plugin-deno-functions) | Edge function documentation |
| [plugin-depgraph](/plugins/plugin-depgraph) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-depgraph.svg)](https://www.npmjs.com/package/@sbtools/plugin-depgraph) | Dependency graph visualization |
| [plugin-docs-server](/plugins/plugin-docs-server) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-docs-server.svg)](https://www.npmjs.com/package/@sbtools/plugin-docs-server) | Swagger UI, ReDoc, SchemaSpy |
| [plugin-erd](/plugins/plugin-erd) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-erd.svg)](https://www.npmjs.com/package/@sbtools/plugin-erd) | Mermaid ERD diagram generation |
| [plugin-frontend-usage](/plugins/plugin-frontend-usage) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-frontend-usage.svg)](https://www.npmjs.com/package/@sbtools/plugin-frontend-usage) | Frontend Supabase SDK usage scanner |
| [plugin-logs](/plugins/plugin-logs) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-logs.svg)](https://www.npmjs.com/package/@sbtools/plugin-logs) | Docker logs, pg_stat_statements |
| [plugin-scaffold](/plugins/plugin-scaffold) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-scaffold.svg)](https://www.npmjs.com/package/@sbtools/plugin-scaffold) | Scaffold new plugins |
| [plugin-typegen](/plugins/plugin-typegen) | [![npm](https://img.shields.io/npm/v/@sbtools/plugin-typegen.svg)](https://www.npmjs.com/package/@sbtools/plugin-typegen) | TypeScript type generation |

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
