# Plan: Platform Catalog Completion and Expansion

## Goal

Close the current tool/workflow catalog gaps against `docs/plans/platform-status-and-roadmap.md`, then extend the roadmap with additional high-impact tools/workflows for the backend-building vision.

## Part A — Implement Missing Catalog Items

### A1) Add Missing Workflow Modules

Create new workflow definitions under `packages/plugin-migration-studio/src/workflows/`:

1. `create-table.workflow.ts`
   - `studio-create-table` → `studio-lint`
2. `add-rls-policy.workflow.ts`
   - `studio-add-rls-policy` → `studio-rls-check`
3. `release-check.workflow.ts`
   - `studio-rls-check` → `studio-rpc-lint` → `studio-lint` → `studio-release-gate`

These are cataloged workflow definitions (discoverable by `*.workflow.ts`) and can be run via engine consumers.

### A2) Resolve Naming Inconsistency: `studio-lint` vs `studio-migration-lint`

Add command/ID compatibility support so roadmap and CLI expectations are both valid:

- Keep current canonical tool id and command `studio-lint` (no breaking change).
- Add alias command `studio-migration-lint` that executes the same tool.
- Update docs to clearly mark alias/canonical naming.

### A3) Resolve Tool Surface Mismatch in Roadmap

Roadmap currently claims HTTP exposure for `studio-intent-sync` and `studio-intent-init`.

Implementation choice:
- Add HTTP routes for both tools through catalog metadata (minimal handlers, no behavioral rewrite), or
- Update roadmap to mark them workflow-only.

Preferred: expose HTTP for consistency with catalog table in roadmap.

### A4) Update Roadmap to Current Architecture

Revise `docs/plans/platform-status-and-roadmap.md` so references match real structure:

- `tools/modules/*.tool.ts` + `tools/core/*.core.ts`
- `workflows/*.workflow.ts`
- current command names + aliases
- updated workflow inventory and completion status

## Part B — Expand Vision with New Tools/Workflows

Append a new section to roadmap proposing (not implementing yet) additional platform-capability items.

### B1) New Tool Proposals

1. `studio-drift-check`
   - Compare live DB vs latest migration+intent state, produce drift report artifact.
2. `studio-rollback-plan`
   - Generate conservative rollback SQL guidance for last N planned changes.
3. `studio-data-backfill-plan`
   - Detect non-null/default migrations that need data backfill and generate staged plan.
4. `studio-policy-simulate`
   - Evaluate RLS policy outcomes for sample roles/queries before apply.
5. `studio-breaking-change-check`
   - Detect API/contract-breaking DB changes (drops/renames/type narrowing) and severity-rank them.

### B2) New Workflow Proposals

1. `safe-release`
   - plan → lint → rls-check → rpc-lint → release-gate → apply
2. `greenfield-bootstrap`
   - greenfield-init → create-table × N → add-rls-policy × N → release-check
3. `rpc-publish`
   - add-function/create-rpc → rpc-lint → endpoint-map → release-gate
4. `schema-change-with-backfill`
   - add-column/create-table → data-backfill-plan → migration-lint → release-check

## Validation

After Part A implementation:

1. `npm run build -w packages/plugin-migration-studio`
2. `npm run test -w packages/plugin-migration-studio`
3. Verify discovery lists new workflows.
4. Verify alias command registration and intended behavior.

## Constraints

- No destructive behavior changes.
- Keep backward compatibility for existing command users.
- Keep single-source catalog architecture (`*.tool.ts` / `*.workflow.ts` discovery).

