# Plan: Unify Tool Filenames in plugin-migration-studio

## Objective

Standardize tool implementation filenames to one naming convention across:

- `src/tools/core/`
- `src/tools/modules/`

without changing behavior.

## Proposed Convention

- Canonical modules: keep `studio-<tool>.tool.ts`
- Core implementations: rename to `studio-<tool>.core.ts`

Example:
- `generate-add-column.ts` → `studio-add-column.core.ts`
- `migration-plan.ts` → `studio-migration-plan.core.ts`

## Steps

1. Rename all `src/tools/core/*.ts` files to `studio-*.core.ts`.
2. Update imports in:
   - `src/tools/modules/*.tool.ts`
   - `tests/tools/*.test.ts`
3. Verify there are no stale imports.
4. Run:
   - `npm run build -w packages/plugin-migration-studio`
   - `npm run test -w packages/plugin-migration-studio`

## Constraints

- No functional/API changes.
- Preserve all command names, route paths, and artifact behavior.

