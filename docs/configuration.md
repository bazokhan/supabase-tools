---
description: Full reference for supabase-tools.config.json — paths, db, api, plugins, and validation.
---

# Configuration

All fields in `supabase-tools.config.json` are optional. Defaults work out of the box.

## Full Reference

```json
{
  "paths": {
    "migrations": "supabase/migrations",
    "snapshot": "supabase/current",
    "docsOutput": "docs",
    "functions": "supabase/functions"
  },
  "db": {
    "url": "postgresql://postgres:postgres@localhost:54322/postgres",
    "container": "supabase-db"
  },
  "api": {
    "url": "http://localhost:54321",
    "studioUrl": "http://localhost:54323",
    "inbucketUrl": "http://localhost:54324"
  },
  "project": {
    "name": "your-project-name"
  },
  "plugins": [
    { "path": "@sbtools/plugin-erd", "config": { "displayColumns": ["name", "email"] } },
    { "path": "@sbtools/plugin-typegen", "config": { "typesOutput": "src/types/supabase.ts" } },
    { "path": "@sbtools/plugin-db-test", "config": { "testsDir": "supabase/tests" } }
  ]
}
```

## Overrides

**Database URL** — Set via env: `DATABASE_URL`, `SUPABASE_DB_URL`, or `POSTGRES_URL`.

**External Supabase** — Set `api.url` to your instance (e.g. `https://your-project.supabase.co`).

**Plugin config** — Each plugin has its own `config` object for plugin-specific settings (output paths, feature flags, etc.). Set `enabled: false` to disable without removing the entry. See individual plugin docs for available config keys.

## Validation

Invalid config produces clear errors:

```
❌ Invalid supabase-tools.config.json:
  • api.url: api.url must be a valid URL
  • plugins.0.path: Plugin path must be a non-empty string
```

Unknown top-level keys are rejected (strict mode).
