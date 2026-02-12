# @sbt/plugin-db-test

Plugin that runs pgTAP database tests. Lives in `supabase-tools/packages/plugin-db-test/`.

## When to Use

Use this plugin when the user needs to:
- Run database integration tests
- Test migrations in isolation (--mem mode)
- Execute pgTAP .sql test files

## CLI Commands

- `sbt test` — Run tests against live database (requires `sbt start`).
- `sbt test --mem` — Run tests in-memory with PGlite, applying migrations first.

## Configuration

- `testsDir` — Test directory (default: `supabase/tests`)
- `migrationsDir` — Migrations for --mem mode (default: `supabase/migrations`)

## File Layout

```
plugin-db-test/
├── src/index.ts      # SbtPlugin with test command
├── runner-live.ts    # Live PostgreSQL execution
├── runner-mem.ts     # PGlite in-memory execution
└── test-utils.ts    # pgTAP helpers
```
