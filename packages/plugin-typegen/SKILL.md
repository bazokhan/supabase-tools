# @sbtools/plugin-typegen

Plugin that generates TypeScript types from the PostgREST types generator. Lives in `supabase-tools/packages/plugin-typegen/`.

## When to Use

Use this plugin when the user needs to:
- Generate or regenerate Supabase TypeScript types
- Keep `.sbt/types/supabase.ts` in sync with the database schema (or configured `typesOutput`)
- Get typed client after schema changes

## CLI Commands

- `sbt generate-types` — Fetch types from the running instance, write to configured output path.

## Configuration

- `typesOutput` — Output file (default: `.sbt/types/supabase.ts`)
- `SUPABASE_TYPES_SCHEMAS` — Optional env var to limit schemas (e.g. `public,auth`)

## File Layout

```
plugin-typegen/
└── src/index.ts   # SbtPlugin with generate-types command
```
