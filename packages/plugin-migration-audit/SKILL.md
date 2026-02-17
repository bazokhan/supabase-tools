# @sbtools/plugin-migration-audit

## Purpose

Read-only migration analysis. Compares migration `.sql` files on disk with `app_migrations.schema_migrations` in the database. Detects drift, missing files, pending migrations, and ordering gaps. Reports via CLI, JSON, HTML, and Backend Atlas. **Never modifies schema.**

## Data Sources

- `paths.migrations` (e.g. `supabase/migrations`) — migration `.sql` files
- Database: `app_migrations.schema_migrations` (version, applied_at)
- DB metadata: public tables, schemas, function/trigger/policy/view counts, DB size, PG version

Database is optional. If unreachable, audit runs disk-only and reports `databaseReachable: false`.

## Commands

```
sbt migration-audit              CLI summary + HTML + open browser
sbt migration-audit --json       Output raw AuditResult JSON
sbt migration-audit --html       Generate only docs/migration-audit.html
sbt migration-audit --no-open   Skip opening HTML in browser
sbt migration-audit -h/--help    Show help
```

## Output Files

- `docs/migration-audit.html` — Self-contained dark-theme report with stats bar, issues panel, filterable migration table, schema overview, timeline

## Issue Codes

| Code | Severity | Meaning |
|------|----------|---------|
| MISSING_FILE | error | Applied in DB, file gone on disk |
| PENDING_MIGRATION | warning | Files on disk not yet applied |
| NO_TRACKING_TABLE | warning | `app_migrations.schema_migrations` missing |
| ORDERING_GAP | warning | Applied out of chronological order (by filename timestamp) |
| TIMESTAMP_PARSE_FAILURE | info | No YYYYMMDDHHMMSS prefix in filename |
| EMPTY_MIGRATION | info | 0-byte file |

## Atlas Integration

When `sbt generate-atlas` runs, contributes:
- `migration_audit` category: summary object + migration cards
- Stats: migrations_total, migrations_applied, migrations_pending, migrations_missing

When `sbt dashboard` runs, contributes:
- "Migration Audit" section with summary stats and link to full report
- Migration cards rendered via GenericSection

## Configuration

No configuration fields needed. Add to `supabase-tools.config.json`:

```json
{
  "path": "node_modules/@sbtools/plugin-migration-audit",
  "config": {}
}
```

Uses `ctx.paths.migrations` and `ctx.paths.docsOutput`.

## DB URL Resolution

Same as `plugin-erd`: `DATABASE_URL` → `SUPABASE_DB_URL` → `POSTGRES_URL` → default local URL.
