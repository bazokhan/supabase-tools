# @sbtools/plugin-atlas-html

Plugin for [supabase-tools](https://github.com/supabase/supabase) that generates the Backend Atlas HTML visualization. Aggregates data from core extractors and sibling plugins into a single interactive HTML document.

## Quick Start

```bash
# Generate atlas (requires sibling plugins for full data)
npm run sbt -- generate-atlas

# Generate the Atlas HTML page
npm run sbt -- atlas-html
```

## Commands

| Command | Description |
|---------|-------------|
| `atlas-html` | Generate `docs/backend-atlas.html` with all plugin contributions |

## Configuration

Configured via `supabase-tools.config.json` paths. No plugin-specific config required.

## Dependencies

| Type | Requirement |
|------|-------------|
| Files | `docs/backend-atlas-data.json` must exist (run `sbt generate-atlas` first) |

## Project Structure

```
packages/plugin-atlas-html/
├── src/
│   ├── index.ts           # Plugin entry, command registration
│   ├── layout.ts          # HTML document assembly
│   └── atlas/
│       ├── bootstrap.ts   # Client-side JS (filters, rendering)
│       ├── constants.ts   # Kind labels, section IDs
│       ├── filters.ts    # Filter utilities
│       ├── helpers.ts    # Shared helpers
│       ├── renderers.ts   # Card/section renderers
│       ├── views/        # Hero, controls, section templates
│       └── styles/       # Base, cards, section CSS
├── package.json
├── tsconfig.json
└── README.md
```
