# @sbtools/plugin-typegen

Plugin for [supabase-tools](https://github.com/supabase/supabase) that generates TypeScript types from the running Supabase instance. Uses the PostgREST types generator endpoint.

## Quick Start

```bash
# Ensure database is running (sbt start)
npm run sbt -- generate-types
# Output: src/integrations/supabase/types.ts (or configured path)
```

## Commands

| Command | Description |
|---------|-------------|
| `generate-types` | Fetch TypeScript types from PostgREST and write to file |

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `typesOutput` | `src/integrations/supabase/types.ts` | Output file path |

Environment: `SUPABASE_TYPES_SCHEMAS` to limit schemas (comma-separated).

## Project Structure

```
packages/plugin-typegen/
├── src/
│   └── index.ts   # Plugin entry, generate-types command
├── package.json
├── tsconfig.json
└── README.md
```
