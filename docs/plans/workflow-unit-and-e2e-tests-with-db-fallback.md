# Plan: Add Workflow Unit + End-to-End Tests (DB-Aware Fallback)

## Goal

Add robust test coverage for workflow catalogs and execution:

1. **Unit tests** for workflow definitions/discovery/filtering logic.
2. **End-to-end workflow tests** that can run against a real Supabase/Postgres DB when available.

## Scope

- `packages/plugin-migration-studio/tests/engine/*`
- `packages/plugin-migration-studio/tests/workflows/*` (new)
- `packages/plugin-migration-studio/tests/e2e/*` (new)
- Optional small helper in tests for DB availability checks

## What to add

### A) Unit tests

1. Workflow discovery coverage
   - verify all expected workflow IDs are discovered:
     - `adopt-backend`
     - `release-check`
     - `create-table`
     - `add-rls-policy`
2. Workflow shape checks
   - ensure each workflow has non-empty steps
   - ensure every step references a real discovered tool ID
3. Catalog filter tests
   - verify `getCatalog()` filtering by `audience`, `mode`, and `type`

### B) End-to-end workflow tests

1. `release-check` e2e (artifact-driven)
   - create temp project dir with minimal required artifacts
   - run workflow through engine and confirm output artifact chain + final status

2. `adopt-backend` e2e (DB-backed when available)
   - check DB availability using plugin SDK PG client
   - if DB unavailable:
     - `console.warn` with clear instruction to run `sbt start`
     - mark test skipped (non-failing)
   - if DB available:
     - run `studio-introspect` + `studio-sql-parse` + resume checkpoints to completion
     - assert `studio.intent.graph` artifact exists and workflow status is `completed`

## DB behavior requirement

- No forced infra startup in tests by default.
- Prefer existing local Supabase stack if running.
- If unavailable, skip DB-dependent e2e with actionable warning.
- Do not leave temporary DB resources running.

## Validation

1. `npm run test -w packages/plugin-migration-studio`
2. Ensure DB-unavailable environments still pass (with warning + skipped DB e2e).
3. Ensure DB-available environments run and pass full adopt-backend e2e.

