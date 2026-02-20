---
"@sbtools/plugin-migration-studio": minor
"@sbtools/ui-web": minor
---

Migration Studio Platform Phase 5 — CLI, HTTP routes, scaffold tools, Adoption dashboard page

**`@sbtools/plugin-migration-studio`**

- feat: CLI commands — `studio-introspect`, `studio-sql-parse`, `studio-adopt`, `studio-add-column`, `studio-add-function`, `studio-create-rpc`
- feat: HTTP routes on port 3335 — `/api/studio/introspect`, `/api/studio/sql-parse`, `/api/studio/intent-graph`, `/api/studio/adopt/*`, `/api/studio/scaffold/*`
- feat: scaffold tools — `generate-add-column`, `generate-add-function`, `generate-create-rpc` (write migration files to `supabase/migrations/`)
- feat: `getAtlasData()` — contributes `studio_intent_entities` to atlas for overview integration
- feat: `getDashboardView()` — add Intent Graph section with entity table

**`@sbtools/ui-web`**

- feat: Adoption page — workflow status, Start/Resume/Restart, step table, intent graph entity table; fetches from studio server (port 3335)
- feat: add Adoption nav item and route; visible when migration_studio plugin loaded
