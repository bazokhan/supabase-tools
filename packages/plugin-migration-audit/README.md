# @sbtools/plugin-migration-audit

Plugin for [supabase-tools](../../) that compares migration files on disk with the `app_migrations.schema_migrations` tracking table. Detects drift, inconsistencies, and reports via CLI, JSON, HTML report, and Backend Atlas integration. **Read-only** — makes zero schema modifications.

## Quick Start

```bash
# 1. Add to supabase-tools.config.json → plugins array:
#    { "path": "@sbtools/plugin-migration-audit", "config": {} }

# 2. Run audit (DB optional — degrades to disk-only if unreachable)
sbt migration-audit
#    → docs/migration-audit.html
#    → CLI summary + open in browser
```

## Commands

| Command | Description |
|---------|-------------|
| `migration-audit` | CLI summary + HTML report + open browser |
| `migration-audit --json` | Output raw audit JSON to stdout |
| `migration-audit --html` | Generate only the HTML report |
| `migration-audit --no-open` | Skip opening the report in browser |
| `migration-audit --help` | Show full help |

## Issues Detected

| Code | Severity | Description |
|------|----------|-------------|
| `MISSING_FILE` | error | Applied in DB but file missing on disk |
| `PENDING_MIGRATION` | warning | Files on disk not yet applied |
| `NO_TRACKING_TABLE` | warning | `app_migrations.schema_migrations` does not exist |
| `ORDERING_GAP` | warning | Migrations applied out of chronological order |
| `TIMESTAMP_PARSE_FAILURE` | info | Non-standard filename (no YYYYMMDDHHMMSS prefix) |
| `EMPTY_MIGRATION` | info | 0-byte migration files |

## HTML Report

The generated `docs/migration-audit.html` provides:

- Stats bar: Total, Applied, Pending, Missing, Issues, DB Size, PG Version
- Issues panel: Color-coded alerts by severity (red=error, amber=warning, blue=info)
- Migration table: Filterable/searchable, sortable columns
- Schema overview: Table chips, counts (tables, functions, triggers, policies, views)
- Timeline: Vertical timeline with color-coded dots per migration status

## Configuration

Add to `supabase-tools.config.json`:

```json
{
  "plugins": [
    {
      "path": "@sbtools/plugin-migration-audit",
      "config": {}
    }
  ]
}
```

No config fields needed — migrations path from `paths.migrations`, output to `paths.docsOutput`.

## Dependencies

| Type | Requirement |
|------|-------------|
| Database | Optional. Uses `DATABASE_URL` / `SUPABASE_DB_URL` / `POSTGRES_URL` (default: `postgresql://postgres:postgres@localhost:54322/postgres`) |
| Files | `paths.migrations` directory (e.g. `supabase/migrations`) |

Graceful degradation: if DB is unreachable, audit runs disk-only and reports `databaseReachable: false`.

## Atlas Integration

When `sbt generate-atlas` and `sbt atlas-html` run, this plugin contributes:

- A "Migration Audit" section with summary stats (total, applied, pending, missing, issues)
- A link to the full HTML report
- Migration cards expandable in the Atlas HTML

## Requirements

- Node.js 18+
- `pg` (runtime dependency)
- `@sbtools/sdk` ^0.3.0

## Project Structure

```
plugin-migration-audit/
├── src/
│   ├── index.ts           # Plugin entry, CLI, Atlas hooks
│   ├── types.ts           # Interfaces
│   ├── db-client.ts       # pg Client, read-only queries
│   ├── migration-scanner.ts # Filesystem scanner
│   ├── auditor.ts         # Compare disk vs DB, detect issues
│   ├── html-generator.ts  # HTML report
│   └── atlas/
│       ├── sections.ts    # Section HTML stub
│       ├── cards.ts       # Card renderer JS
│       └── styles.ts      # CSS
├── package.json
├── tsconfig.json
├── SKILL.md
└── README.md
```
