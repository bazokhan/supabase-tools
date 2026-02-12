# Configuration

All fields in `supabase-tools.config.json` are optional. Defaults work out of the box.

## Full Reference

```json
{
  "paths": {
    "migrations": "supabase/migrations",
    "tests": "supabase/tests",
    "snapshot": "supabase/current",
    "docsOutput": "docs",
    "erdOutput": "docs/entity-relations",
    "typesOutput": "src/integrations/supabase/types.ts",
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
  "erd": {
    "displayColumns": ["name", "email", "full_name", "slug", "title"]
  },
  "project": {
    "name": "your-project-name"
  },
  "plugins": [
    { "path": "@sbtools/plugin-erd", "config": {} },
    { "path": "@sbtools/plugin-logs", "enabled": true, "config": {} }
  ]
}
```

## Overrides

**Database URL** — Set via env: `DATABASE_URL`, `SUPABASE_DB_URL`, or `POSTGRES_URL`.

**External Supabase** — Set `api.url` to your instance (e.g. `https://your-project.supabase.co`).

**Plugin config** — Each plugin can have its own `config` object. Set `enabled: false` to disable without removing the entry.

## Validation

Invalid config produces clear errors:

```
❌ Invalid supabase-tools.config.json:
  • api.url: api.url must be a valid URL
  • plugins.0.path: Plugin path must be a non-empty string
```

Unknown top-level keys are rejected (strict mode).
