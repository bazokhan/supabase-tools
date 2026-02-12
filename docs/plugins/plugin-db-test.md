# @sbtools/plugin-db-test

Plugin that runs database tests using pgTAP. Supports live database mode (Docker) or in-memory PGlite mode.

## Quick Start

```bash
npm install @sbtools/plugin-db-test
```

Add to config: `{ "path": "@sbtools/plugin-db-test" }`

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
| `test --mem` | Run tests in-memory via PGlite |
| `test --server` | Run tests against server |

## Configuration

Plugin config goes in `plugins[].config`:

```json
{
  "plugins": [{
    "path": "@sbtools/plugin-db-test",
    "config": { "testsDir": "supabase/tests" }
  }]
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `testsDir` | `supabase/tests` | Directory containing .sql test files |
| `migrationsDir` | Root `paths.migrations` | Migrations to apply in --mem mode |
