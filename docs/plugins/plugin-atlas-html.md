---
description: atlas-html command (built into core) — Generate Backend Atlas HTML visualization.
---

# atlas-html command (Built-in)

The `atlas-html` command is **built into @sbtools/core** — no plugin installation required. It generates the Backend Atlas HTML visualization, aggregating data from core extractors and sibling plugins into a single interactive HTML document.

> Previously provided by `@sbtools/plugin-atlas-html`, which has been merged into core. Remove it from your config if present.

## Usage

```bash
npx sbt generate-atlas   # First: generate backend-atlas-data.json
npx sbt atlas-html       # Then: generate the HTML page
```

## Output

- Writes to `docs/backend-atlas.html` (or `paths.docsOutput`)
- Requires `backend-atlas-data.json` (run `sbt generate-atlas` first)
- Merges UI contributions from plugins via `getAtlasUI` (kind labels, section HTML, card renderers, styles)

## Configuration

Uses `paths.docsOutput` from root config. No plugin-specific config required.
