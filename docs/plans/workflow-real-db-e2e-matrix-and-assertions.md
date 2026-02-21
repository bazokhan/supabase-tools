# Workflow Real-DB E2E Matrix And Assertions

## Goal
Guarantee that every Migration Studio workflow executes end-to-end against:
- real project files (migrations + artifacts on disk)
- a real PostgreSQL/Supabase database

and validate intended outcomes (not just execution success).

## Scope
Package: `packages/plugin-migration-studio`

In scope:
- workflow E2E coverage for all discovered workflows
- real file-system assertions per workflow step/output
- real DB assertions for schema/policy/function effects where applicable
- repeatable test harness with explicit DB availability behavior

Out of scope:
- changing workflow business logic (unless a bug is found)
- UI-level tests

## Current Gaps
- Existing E2E tests cover only a subset of workflows.
- Some checks validate completion but not full behavioral intent per workflow output.
- DB dependency handling exists, but no strict per-workflow matrix of required preconditions and expected state transitions.

## Proposed Implementation

### 1. Build a workflow E2E matrix
Create a canonical test matrix in code mapping each discovered workflow to:
- required inputs/artifacts
- required DB preconditions
- expected output artifacts
- expected DB state changes
- expected no-op/unchanged assertions (where applicable)

This prevents missing workflows as new ones are added.

### 2. Add shared real-environment harness
Add `tests/e2e/harness/` utilities for:
- temp test workspace setup/teardown under `.tmp` (per test run)
- migration directory seeding
- artifact read/write helpers for assertions
- DB connectivity probe
- DB cleanup/reset helpers
- SQL assertion helpers (`table exists`, `policy exists`, `function exists`, column/index/constraint checks)

### 3. Enforce DB mode behavior
For DB-dependent tests:
- if DB is unavailable, print a clear warning that recommends `sbt start`
- mark only DB-dependent specs as skipped (not failed)
- allow opt-in strict mode (env flag) to fail when DB is unavailable in CI contexts

### 4. Add E2E specs per workflow
Create one spec file per workflow (or grouped by domain) that runs the full workflow and verifies:
- workflow run status transitions/checkpoints
- generated files/artifacts on disk with content-level assertions
- DB side effects align with workflow intent
- idempotency / re-run behavior where expected

Target workflows include at least:
- `adopt-backend`
- `release-check`
- `create-table`
- `add-rls-policy`

(plus any newly discovered workflows from registry at test time).

### 5. Add catalog completeness guard
Add a unit/e2e guard test that fails if:
- a workflow exists in discovery but has no E2E coverage entry in the matrix

This ensures future workflow additions require explicit E2E intent assertions.

### 6. Execution scripts and docs
- Add/adjust npm scripts for:
  - fast unit-only
  - DB-aware E2E
  - strict DB E2E mode
- update plugin docs with:
  - how to run full workflow E2E locally
  - DB prerequisites and fallback behavior

### 7. Changeset
Add a changeset describing expanded workflow test guarantees and contributor expectations.

## Validation Plan
- `npm run build -w packages/plugin-migration-studio`
- `npm run test -w packages/plugin-migration-studio` (default behavior)
- dedicated DB E2E command with local Supabase running
- verify each workflow has:
  - coverage matrix entry
  - passing end-to-end assertions

## Risks / Mitigations
- Flaky DB state between tests:
  - use isolated schema names or deterministic cleanup per test
- Slow runtime:
  - split unit and DB suites, parallelize safe specs
- Environment drift:
  - explicit preflight checks + clear actionable warnings
