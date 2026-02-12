# Plugins

Plugins extend supabase-tools with additional commands and integrations. Install via npm and add to `supabase-tools.config.json`.

## Available Plugins

| Plugin | Description |
|--------|-------------|
| [plugin-atlas-html](/plugins/plugin-atlas-html) | Backend Atlas HTML visualization |
| [plugin-db-test](/plugins/plugin-db-test) | pgTAP test runner (live + PGlite) |
| [plugin-deno-functions](/plugins/plugin-deno-functions) | Edge function documentation |
| [plugin-depgraph](/plugins/plugin-depgraph) | Dependency graph visualization |
| [plugin-docs-server](/plugins/plugin-docs-server) | Swagger UI, ReDoc, SchemaSpy |
| [plugin-erd](/plugins/plugin-erd) | Mermaid ERD diagram generation |
| [plugin-frontend-usage](/plugins/plugin-frontend-usage) | Frontend Supabase SDK usage scanner |
| [plugin-logs](/plugins/plugin-logs) | Docker logs, pg_stat_statements |
| [plugin-scaffold](/plugins/plugin-scaffold) | Scaffold new plugins |
| [plugin-typegen](/plugins/plugin-typegen) | TypeScript type generation |

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
