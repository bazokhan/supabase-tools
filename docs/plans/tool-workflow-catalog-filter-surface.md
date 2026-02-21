# Plan: Add Filterable Tool/Workflow Catalog Surface (Audience + Control Modes)

## Objective

Expose the discovered tool/workflow catalogs in a consumable way, with filtering by:

- `audience`: `backend-dev` | `business` | `mixed`
- `controlModes`: `managed` | `assisted` | `loose`

for both CLI and HTTP usage.

## Scope

- `packages/plugin-migration-studio/src/index.ts`
- `packages/plugin-migration-studio/src/server.ts`
- discovery/contracts already in `tools/*` and `workflows/*`

## Deliverables

1. New CLI command:
   - `sbt studio-catalog [--audience <...>] [--mode <...>] [--type tools|workflows|all]`
   - Prints compact catalog rows from discovered modules.

2. New HTTP route:
   - `GET /api/studio/catalog?audience=<...>&mode=<...>&type=tools|workflows|all`
   - Returns JSON with filtered tools/workflows and metadata.

## Behavior

- Filtering is additive:
  - `audience` must match exactly when provided.
  - `mode` must be included in `controlModes` when provided.
- `type` defaults to `all`.
- For workflows, expose:
  - id, description, steps, inferred audiences/modes from referenced tools.

## Implementation Steps

1. Add local helpers to normalize query/arg filters.
2. Build filtered catalog functions from existing discovered registries.
3. Wire CLI command in `index.ts`.
4. Wire HTTP route in `server.ts`.
5. Keep outputs stable and concise.
6. Run:
   - `npm run build -w packages/plugin-migration-studio`
   - `npm run test -w packages/plugin-migration-studio`

## Constraints

- No changes to existing tool execution paths.
- No breaking changes to existing routes/commands.

