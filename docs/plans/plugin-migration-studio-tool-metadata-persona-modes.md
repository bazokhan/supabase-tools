# Plan: Tag All Tool Metadata with Audience and Control Modes

## Objective

Populate every tool module metadata block with:

- `audience`: `backend-dev` | `business` | `mixed`
- `controlModes`: subset of `managed` | `assisted` | `loose`

to make the catalog filterable by persona and operating style.

## Scope

- `packages/plugin-migration-studio/src/tools/modules/*.tool.ts`
- No behavior changes to tool execution, CLI, HTTP routes, or workflows

## Mapping Rules

1. Low-level schema/validation tools default to `backend-dev`.
2. High-level orchestration/reporting tools default to `mixed`.
3. Any tool that strictly depends on intent classification includes `managed`.
4. Generator/scaffold tools include `assisted` and `loose` where they can be used pragmatically.

## Steps

1. Update all existing `metadata` objects in `*.tool.ts` with `audience` and `controlModes`.
2. Keep wording concise and consistent.
3. Run:
   - `npm run build -w packages/plugin-migration-studio`
   - `npm run test -w packages/plugin-migration-studio`

## Deliverable

- Fully tagged tool catalog metadata, ready for UI/API filtering by persona and mode.

