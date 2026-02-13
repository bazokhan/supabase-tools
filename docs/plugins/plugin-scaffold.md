---
description: Scaffold new supabase-tools plugins with consistent boilerplate and SDK integration.
---

# @sbtools/plugin-scaffold

[![npm](https://img.shields.io/npm/v/@sbtools/plugin-scaffold.svg)](https://www.npmjs.com/package/@sbtools/plugin-scaffold)

Plugin that scaffolds new supabase-tools plugins with consistent boilerplate.

## Quick Start

```bash
npm install @sbtools/plugin-scaffold
```

Add to config: `{ "path": "@sbtools/plugin-scaffold" }`

```bash
# Internal plugin (packages/plugin-<name>/)
npx sbt scaffold-plugin analytics

# External plugin (sibling directory)
npx sbt scaffold-plugin my-feature --external

# With Atlas hooks
npx sbt scaffold-plugin dashboard --hooks
```

## Commands

| Command | Description |
|---------|-------------|
| `scaffold-plugin <name>` | Create internal plugin |
| `scaffold-plugin <name> --external` | Create external plugin |
| `scaffold-plugin <name> --hooks` | Include Atlas hook stubs |

```
$ npx sbt scaffold-plugin analytics

Scaffolding plugin: analytics
  ✓ packages/plugin-analytics/package.json
  ✓ packages/plugin-analytics/tsconfig.json
  ✓ packages/plugin-analytics/src/index.ts
  ✓ packages/plugin-analytics/README.md

Done — run `npm install` to link the new package.
```

## Configuration

No config required.
