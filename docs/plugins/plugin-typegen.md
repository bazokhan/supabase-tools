# @sbtools/plugin-typegen

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
