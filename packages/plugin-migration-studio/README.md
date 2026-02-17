# @sbtools/plugin-migration-studio

Migration authoring UI for supabase-tools. Create migrations in a browser-based editor, analyze SQL, and apply via the core `sbt migrate` flow.

## Features

- **SQL editor** — Write migration SQL in the browser
- **Modern dark theme** — Black-first visual style aligned with dashboard aesthetics
- **Live analysis** — Analyze SQL to see operations and risk indicators (uses shared `analyzeMigrationSql` from SDK)
- **Save / Update migration** — Create new or overwrite pending migration; dry run before apply; wrap in transaction
- **Apply migrations** — Runs `sbt migrate` (requires confirmation)
- **Live refresh bridge** — SSE endpoint (`/api/events`) refreshes migration/status context when `sbt watch` updates artifacts
- **Dashboard embedding support** — Works both as standalone Studio and embedded inside dashboard migrations flow

## Setup

Add to `supabase-tools.config.json`:

```json
{
  "plugins": [
    { "path": "@sbtools/plugin-migration-studio", "config": {} }
  ]
}
```

## Usage

```bash
sbt migration-studio
```

Opens the studio at http://localhost:3335. Use `--port N` to change the port.

## Contract

- **Produces:** `migration.studio.draft` (planned)
- **Consumes:** `migration.analysis` (optional — for richer context when migration-audit has run)

Apply path uses the core migration execution flow; no duplicate migration engine.
