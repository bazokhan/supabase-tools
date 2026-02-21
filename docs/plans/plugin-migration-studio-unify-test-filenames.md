# Plan: Unify Test Filenames in plugin-migration-studio

## Objective

Standardize `packages/plugin-migration-studio/tests/tools` filenames to match the unified tool naming style.

## Proposed Convention

- Test files: `studio-<tool>.test.ts`

Examples:
- `generate-add-column.test.ts` → `studio-add-column.test.ts`
- `migration-plan.test.ts` → `studio-migration-plan.test.ts`

## Steps

1. Rename all `tests/tools/*.test.ts` files to `studio-*.test.ts`.
2. Verify no import/path assumptions break.
3. Run:
   - `npm run build -w packages/plugin-migration-studio`
   - `npm run test -w packages/plugin-migration-studio`

## Constraints

- No behavior changes.
- Keep test content unchanged except path/filename references if needed.

