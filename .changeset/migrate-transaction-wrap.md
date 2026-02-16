---
"@sbtools/core": patch
---

# Migrate: wrap each migration in a transaction

`psql` runs in autocommit mode when reading from stdin, so each statement committed independently. A migration file with multiple statements could partially apply: the first statement committed, the second failed, and the migration was never recorded in `schema_migrations`.

Now each migration file is wrapped in `BEGIN;` and `COMMIT;`. If any statement fails, the entire migration rolls back and nothing is committed.

**Note:** Migrations using `CREATE INDEX CONCURRENTLY` (which cannot run inside a transaction) will fail. Use a separate migration file for CONCURRENTLY operations or run them manually.
