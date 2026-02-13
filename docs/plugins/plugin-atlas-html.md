---
description: Generate Backend Atlas HTML visualization. Aggregates data from core extractors and sibling plugins.
---

# @sbtools/plugin-atlas-html

[![npm](https://img.shields.io/npm/v/@sbtools/plugin-atlas-html.svg)](https://www.npmjs.com/package/@sbtools/plugin-atlas-html)

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

```
$ npx sbt atlas-html

Collecting data from plugins...
  ✓ erd (63 tables)
  ✓ deno-functions (4 functions)
  ✓ depgraph (142 relationships)

✓ Written to docs/backend-atlas.html
```

## Configuration

Uses `paths.docsOutput` from root config for the output directory. No plugin-specific config required.
