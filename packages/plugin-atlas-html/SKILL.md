# @sbt/plugin-atlas-html

Plugin that generates the Backend Atlas HTML visualization. Lives in `supabase-tools/packages/plugin-atlas-html/`.

## When to Use

Use this plugin when the user needs to:
- Generate the Backend Atlas HTML page
- Visualize tables, functions, policies, triggers, edge functions, etc. in one dashboard
- View the combined OpenAPI/Swagger documentation

## CLI Commands

- `sbt atlas-html` — Generate `docs/backend-atlas.html` with data from core extractors and all registered plugins.

## Configuration

No plugin-specific config. Uses `paths.docsOutput` from `supabase-tools.config.json` for output location.

## File Layout

```
plugin-atlas-html/
├── src/index.ts        # SbtPlugin with atlas-html command
├── layout.ts           # Assembles HTML from plugin contributions
└── atlas/              # Bootstrap script, styles, views
```
