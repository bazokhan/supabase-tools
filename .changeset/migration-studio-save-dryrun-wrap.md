---
"@sbtools/plugin-migration-studio": patch
---

# Migration Studio: save-overwrite, dry run, wrap in transaction

- **Update pending migration** — When a pending migration is loaded from the sidebar, Save becomes "Update migration" and overwrites that file instead of always creating a new one. "Save as new" creates a new file when editing an existing migration.
- **Dry run** — Validates SQL using the same formatting as `sbt migrate` (transaction wrap, semicolon handling), so dry run accurately predicts apply success.
- **Wrap in transaction** — Button wraps selected (or full) SQL in `BEGIN;` and `COMMIT;`.
