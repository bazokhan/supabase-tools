---
description: Generate TypeScript types from the running Supabase instance using the PostgREST types endpoint.
---

# @sbtools/plugin-typegen

[![npm](https://img.shields.io/npm/v/@sbtools/plugin-typegen.svg)](https://www.npmjs.com/package/@sbtools/plugin-typegen)

Plugin that generates TypeScript types from the running Supabase instance using the PostgREST types endpoint.

## Quick Start

```bash
npm install @sbtools/plugin-typegen
```

Add to config: `{ "path": "@sbtools/plugin-typegen" }`

```bash
# Ensure database is running
npx sbt start
npx sbt generate-types
# Output: src/integrations/supabase/types.ts
```

## Commands

| Command | Description |
|---------|-------------|
| `generate-types` | Fetch types from PostgREST and write to file |

```
$ npx sbt generate-types

Fetching types from http://localhost:54321/rest/v1/?apikey=...
✓ Written to src/integrations/supabase/types.ts (248 tables, 12 views, 34 enums)
```

## Configuration

Plugin config goes in `plugins[].config`:

```json
{
  "plugins": [{
    "path": "@sbtools/plugin-typegen",
    "config": { "typesOutput": "src/types/supabase.ts" }
  }]
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `typesOutput` | `src/integrations/supabase/types.ts` | Output file path |

Environment: `SUPABASE_TYPES_SCHEMAS` to limit schemas (comma-separated).
