# Plan: Cleanup Unneeded Files and Code in plugin-migration-studio

## Objective

Remove files and code in `packages/plugin-migration-studio` that are no longer needed after the tool/workflow single-source refactor, while preserving behavior and tests.

## Scope

- Only `packages/plugin-migration-studio/*`
- No cross-package refactors in `core`, `ui-web`, or other plugins

## Cleanup Criteria

A file/code path is removable only if all are true:

1. Not imported by any source file in plugin package.
2. Not referenced by tests in plugin package.
3. Not required for public exports/package entrypoint behavior.
4. Build + tests still pass after removal.

## Candidate Areas to Audit

1. Transitional compatibility wrappers added during refactor.
2. Legacy duplicated route/command wiring helpers no longer used.
3. Dead helper functions in `index.ts` / `server.ts` left after migration.
4. Any stale workflow/tool registration artifacts now superseded by discovery.

## Implementation Steps

1. Build a local reference map:
   - imports/usages across `src/` and `tests/`
   - detect files with zero references (excluding entrypoints by design)
2. Remove obviously dead files first (starting with wrappers/transitional modules).
3. Remove dead functions/constants inside retained files.
4. Re-run:
   - `npm run build -w packages/plugin-migration-studio`
   - `npm run test -w packages/plugin-migration-studio`
5. If any parity risk appears, revert only that risky deletion and keep safe removals.

## Validation

- Compile success for plugin package.
- Full plugin test suite passes.
- No endpoint/command name changes intended.

## Deliverable

- Minimal, behavior-preserving cleanup commit with only genuinely unused files/code removed.

