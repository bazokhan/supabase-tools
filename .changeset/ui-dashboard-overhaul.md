---
"@sbtools/sdk": minor
"@sbtools/core": minor
"@sbtools/ui-web": minor
"@sbtools/plugin-depgraph": minor
"@sbtools/plugin-frontend-usage": minor
"@sbtools/plugin-logs": minor
"@sbtools/plugin-migration-audit": minor
"@sbtools/plugin-deno-functions": minor
---

Implement UI Dashboard overhaul per ui-modernization-plan.md.

**SDK**
- Add `getDashboardView()` hook and `DashboardView`, `DashboardSectionDef`, `DashboardStatDef`, `DashboardCardDef`, `DashboardTableDef`, and related types (JSON-serializable, zero JS strings)
- Add `itemsPath` and `itemsStartIndex` to `DashboardSectionDef` for nested/sliced item arrays
- Remove `getAtlasUI` and `PluginAtlasUI` (breaking for external plugins using legacy hook)

**Core**
- Add `sbt dashboard` command: serves Vite-built React SPA and APIs (`/api/atlas-data`, `/api/dashboard-config`, `/api/services`, `/api/events`)
- Add built-in dashboard section defs for functions, policies, triggers, views, types, enums
- Remove `getAtlasUI` fallback from `atlas-html` command

**ui-web**
- Add design token CSS with light/dark mode (`src/styles/tokens.css`)
- Add Vite-built React dashboard SPA (`src/dashboard/`): App shell with sidebar and dark mode toggle, pages (Overview, Migrations, Depgraph, Logs, FrontendUsage), shared components (StatCard, Badge, DataTable, CardGrid, SearchInput, CodeBlock, GenericSection), field resolver, data hooks
- Update `document.tsx` to use design token variables and Inter font

**Plugins**
- Add `getDashboardView()` to depgraph, frontend-usage, logs, migration-audit, deno-functions
