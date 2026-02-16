---
"@sbtools/plugin-migration-studio": minor
---

# Migration Studio Real-Time Validation

Adds PostgreSQL syntax validation to protect users before save/apply.

## New

- **POST /api/validate** — Runs SQL in BEGIN/ROLLBACK transaction. Returns `{ valid, error?, line?, dbConnected }`. Degrades gracefully when DB unreachable.
- **Save guard** — Validates before writing; blocks save on syntax error with line number.
- **Analysis panel** — Shows validation errors (red) and "Validation unavailable" (amber) when DB disconnected.
- **Inline lint** — @codemirror/lint integration; squiggly underline on invalid SQL with PostgreSQL error message.
- **Function template** — New "Create function returning text" template with correct `RETURNS text` and `RETURN '...'` inside `$$`.

## Dependencies

- Added `@codemirror/lint` for diagnostics.
