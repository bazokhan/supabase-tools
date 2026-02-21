---
"@sbtools/plugin-migration-studio": patch
---

Harden workflow behavior and testing for Migration Studio:

- update `create-table` workflow to run `studio-sql-parse` before `studio-lint`, ensuring lint evaluates the generated migration
- update `add-rls-policy` workflow to run `studio-sql-parse` before `studio-rls-check`, ensuring pending policy SQL is included in coverage analysis
- add a real-file + real-DB workflow E2E matrix with explicit coverage for every discovered workflow
- add shared E2E harness utilities for DB preflight, strict DB mode (`SBT_STUDIO_E2E_REQUIRE_DB`), and SQL state assertions
