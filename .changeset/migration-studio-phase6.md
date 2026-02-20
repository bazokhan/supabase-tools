---
"@sbtools/plugin-migration-studio": minor
---

Phase 6: four new scaffold tools completing the Layer 3 generate stack.

**New scaffold tools (CLI + HTTP + tests):**
- `sbt studio-create-table` / `POST /api/studio/scaffold/create-table` — generates `CREATE TABLE … ENABLE ROW LEVEL SECURITY`. Greenfield-safe: does not require an existing intent graph. Optionally appends the new entity to the intent graph if one exists.
- `sbt studio-add-rls-policy` / `POST /api/studio/scaffold/add-rls-policy` — generates `CREATE POLICY` with PERMISSIVE/RESTRICTIVE, FOR command, TO roles, USING, and WITH CHECK clauses.
- `sbt studio-add-index` / `POST /api/studio/scaffold/add-index` — generates `CREATE [UNIQUE] INDEX … USING <method> (cols) [WHERE …]`. Auto-names index if not provided.
- `sbt studio-add-constraint` / `POST /api/studio/scaffold/add-constraint` — generates `ALTER TABLE … ADD CONSTRAINT` for foreign key, unique, and check constraints.

All four tools work without an existing intent graph (no bootstrapping requirement).
