---
"@sbtools/plugin-migration-studio": minor
"@sbtools/ui-web": minor
---

Migration Studio Phase 10: intent graph mutation + endpoint mapping

**New tools:**
- `intent-patch` — mutates a single entity's `managedStatus` in the intent graph; supports `exclude` (adds to `managedScope.explicitExclusions`) and `set-status` actions
- `endpoint-map` — derives `EndpointNode` declarations from the intent graph: `table-crud` endpoints for managed entities (with `allowedRoles` from associated policies), `rpc` endpoints for managed public-schema functions; writes results back into the intent graph artifact

**New HTTP routes (studio server port 3335):**
- `POST /api/studio/intent-graph/entity` — patch entity classification
- `POST /api/studio/endpoint-map` — run endpoint derivation

**New CLI commands:**
- `sbt studio-intent-patch --entity <schema.table> --action exclude|set-status [--status ...]`
- `sbt studio-endpoint-map`

**Dashboard Adoption page** — entity table is now interactive: each row shows a color-coded status badge, a "Manage" button (promote to managed), and an "Exclude" button. A "Map Endpoints" button above the table triggers endpoint derivation and shows the resulting count.
