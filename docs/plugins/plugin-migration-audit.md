---
description: Compare migration files with database tracking. Read-only drift detection, CLI/JSON/HTML/Atlas reporting.
---

# @sbtools/plugin-migration-audit

[![npm](https://img.shields.io/npm/v/@sbtools/plugin-migration-audit.svg)](https://www.npmjs.com/package/@sbtools/plugin-migration-audit)

Plugin that compares migration files on disk with `app_migrations.schema_migrations`. Detects drift, missing files, pending migrations. Reports via CLI, JSON, HTML, and Backend Atlas. **Read-only** — makes zero schema modifications.

## Quick Start

```bash
npm install @sbtools/plugin-migration-audit
```

Add to config: `{ "path": "@sbtools/plugin-migration-audit" }`

```bash
# Run audit (DB optional — disk-only if unreachable)
npx sbt migration-audit
# → docs/migration-audit.html
# → CLI summary + open in browser
```

## Commands

| Command | Description |
|---------|-------------|
| `migration-audit` | CLI summary + HTML report + open browser |
| `migration-audit --json` | Output raw audit JSON |
| `migration-audit --html` | Generate HTML only |
| `migration-audit --no-open` | Skip opening browser |

## Issues Detected

| Code | Severity | Description |
|------|----------|-------------|
| `MISSING_FILE` | error | Applied in DB but file missing on disk |
| `PENDING_MIGRATION` | warning | Files not yet applied |
| `NO_TRACKING_TABLE` | warning | `app_migrations.schema_migrations` missing |
| `ORDERING_GAP` | warning | Applied out of chronological order |
| `TIMESTAMP_PARSE_FAILURE` | info | Non-standard filename (no YYYYMMDDHHMMSS prefix) |
| `EMPTY_MIGRATION` | info | 0-byte migration files |

## Configuration

No config fields required. Uses `paths.migrations` and `paths.docsOutput`. Database optional — uses `DATABASE_URL` / `SUPABASE_DB_URL` / `POSTGRES_URL` when available.
