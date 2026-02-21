# Plan: Collapse Legacy `tools/*.ts` Layer into Canonical `*.tool.ts` Modules

## Objective

Remove duplicate legacy files in `packages/plugin-migration-studio/src/tools/*.ts` by moving/keeping all required logic inside canonical self-contained `packages/plugin-migration-studio/src/tools/modules/*.tool.ts` modules, then deleting obsolete legacy files.

## Scope

- Only `packages/plugin-migration-studio`
- Focused on `src/tools/` cleanup
- No functional changes intended

## Steps

1. Build exact dependency map of `src/tools/*.ts` usages from source and tests.
2. For each legacy tool file:
   - move internal helper logic into corresponding `*.tool.ts` module (or nested file under `tools/modules/<tool>/`)
   - keep exported behavior and validations identical
3. Update tests to import from the new canonical module surface where needed.
4. Delete legacy `src/tools/*.ts` files once references reach zero.
5. Run:
   - `npm run build -w packages/plugin-migration-studio`
   - `npm run test -w packages/plugin-migration-studio`

## Safety Rules

- Preserve command names, route paths, artifact IDs, and output/error behavior.
- Delete a legacy file only after zero references are confirmed.
- Keep one canonical source per tool at the end.

## Deliverable

- `tools/` contains only canonical module-based tool implementations (plus discovery/contract files), with no duplicated legacy tool files.

