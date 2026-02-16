---
"@sbtools/core": patch
---

# Migrate: semicolon handling and skip double-wrap

- **Missing semicolon** — If a migration file does not end with `;`, one is appended before `COMMIT;` so psql parses statements correctly (fixes "syntax error at or near COMMIT").
- **Skip double-wrap** — If a migration already starts with `BEGIN;` (e.g. from "Wrap in transaction" in Migration Studio), migrate no longer wraps it again to avoid nested transaction issues.
