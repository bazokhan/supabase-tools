---
"@sbtools/plugin-migration-studio": minor
---

Add catalog-driven tooling surfaces and workflow coverage improvements in Migration Studio.

- Added `studio-catalog` CLI command with filters:
  - `--audience backend-dev|business|mixed`
  - `--mode managed|assisted|loose`
  - `--type tools|workflows|all`
- Added `GET /api/studio/catalog` with equivalent query filters.
- Added workflow definitions discoverable by `*.workflow.ts`:
  - `release-check`
  - `create-table`
  - `add-rls-policy`
- Added lint command alias `studio-migration-lint` (canonical command remains `studio-lint`).
- Added HTTP execution surfaces for:
  - `POST /api/studio/intent-sync`
  - `POST /api/studio/intent-init`
- Expanded tool metadata model with optional persona/control-mode tags:
  - `audience`
  - `controlModes`

