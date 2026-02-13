# @sbtools/plugin-db-test

Plugin for [supabase-tools](https://github.com/supabase/supabase) that runs database tests using pgTAP. Supports live database mode (Docker) or in-memory PGlite mode.

## Quick Start

```bash
# Live mode (requires sbt start)
npm run sbt -- test

# In-memory mode (no Docker required)
npm run sbt -- test --mem
```

## Commands

| Command | Description |
|---------|-------------|
| `test` | Run pgTAP tests from supabase/tests |
| `test --mem` | Run tests in-memory via PGlite (applies migrations first) |

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `testsDir` | `supabase/tests` | Directory containing .sql test files |
| `migrationsDir` | `supabase/migrations` | Migrations to apply in --mem mode |

## Dependencies

| Type | Requirement |
|------|-------------|
| Docker | Must be running for live mode (`sbt test`) |
| Database | DB must be running and accessible for live mode |
| Files | `supabase/tests` — test SQL files must exist |
| Files | Migrations dir must exist for `--mem` mode (no Docker needed) |

## Project Structure

```
packages/plugin-db-test/
├── src/
│   ├── index.ts      # Plugin entry, test command
│   ├── runner-live.ts # Live DB test execution
│   ├── runner-mem.ts  # PGlite in-memory execution
│   └── test-utils.ts  # pgTAP helpers
├── package.json
├── tsconfig.json
└── README.md
```
