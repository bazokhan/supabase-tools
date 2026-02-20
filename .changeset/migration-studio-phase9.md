---
"@sbtools/plugin-migration-studio": minor
"@sbtools/ui-web": minor
---

Phase 9 — Greenfield Workflow + Gate Enforcement.

**`@sbtools/plugin-migration-studio`:**

New tool `studio-greenfield-init` (`tools/greenfield-init.ts`):
- Creates an empty `studio.intent.graph` artifact with `mode: 'greenfield'` and zero entities
- No DB connection required — works from day one on fresh projects
- CLI: `sbt studio-greenfield-init`
- HTTP: `POST /api/studio/greenfield-init`

Gate enforcement in `POST /api/apply`:
- Reads `studio.release.gate` artifact before proceeding
- If gate `status: 'fail'` → 422 response with `gateBlocked: true` and the list of blocking issues; apply is prevented
- If no gate artifact → apply proceeds normally but response includes `gateWarning` advising the user to run `studio-release-gate` before production applies
- Passing gate → apply proceeds unchanged

**`@sbtools/ui-web` (Schema Builder page):**

New **Project Setup** panel (top of `/schema-builder`):
- Fetches intent graph status on load from `GET /api/studio/intent-graph`
- Shows mode badge (Greenfield / Brownfield managed / Brownfield assisted) and entity count when a graph exists
- When no graph is found: displays "Initialize Greenfield Project" button → calls `POST /api/studio/greenfield-init` → refreshes status

New **Release Gate** panel (bottom of `/schema-builder`):
- "Run Gate" button → calls `POST /api/studio/release-gate`
- Displays PASS/FAIL badge, lists blocking issues (red) and warnings (amber) inline
- Gives developers a one-click pre-apply validation check without leaving the dashboard

Layer 3 (Generate) and Layer 5 (Apply) are now at ~100% and ~80% respectively.
