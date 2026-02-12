# @sbtools/plugin-atlas-html

Plugin that generates the Backend Atlas HTML visualization. Aggregates data from core extractors and sibling plugins into a single interactive HTML document.

## Quick Start

```bash
npm install @sbtools/plugin-atlas-html
```

Add to config: `{ "path": "@sbtools/plugin-atlas-html" }`

```bash
npm run sbt -- generate-atlas
npm run sbt -- atlas-html
```

## Commands

| Command | Description |
|---------|-------------|
| `atlas-html` | Generate `docs/backend-atlas.html` with all plugin contributions |

## Configuration

Configured via `supabase-tools.config.json` paths. No plugin-specific config required.
