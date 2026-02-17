# @sbtools/ui-web

## 0.6.0

### Minor Changes

- 4b39da0: Refresh dashboard UX and Studio integration with live operations workflows.

  **@sbtools/ui-web**

  - Redesign dashboard shell with improved dark theme, icon-driven navigation, richer search UI, and clearer detail actions.
  - Add embedded Migration Studio mode directly inside Migrations page.
  - Add live logs tab in dashboard (service filters, stream status, inline search).
  - Improve large dependency graph performance with focused neighborhood rendering and pagination/chunking behavior.
  - Improve details layout for wide content and add quick-open links to related files/snapshots.

  **@sbtools/core**

  - Extend `sbt dashboard` server with live log stream APIs:
    - `GET /api/logs/stream`
    - `GET /api/logs/services`
  - Add safe file browser/open APIs for project artifacts and snapshots:
    - `GET /api/fs/list`
    - `GET /api/fs/file`
  - Keep SPA dashboard endpoints and static serving behavior intact.

  **@sbtools/plugin-migration-studio**

  - Refresh Studio styling to match the modern dark visual language used by dashboard.
  - Improve Studio surface styling (panels, controls, chips, context tabs, editor shell) for better readability and consistency.

- 4b39da0: Centralize browser UI rendering through the new shared `@sbtools/ui-web` package and migrate plugin/core HTML generators away from large page-local template strings.

  ### Added

  - New shared package: `@sbtools/ui-web` with reusable document primitives and renderer modules.
  - New typed Atlas hook in SDK: `getAtlasView()` + `PluginAtlasView`.

  ### Changed

  - `atlas-html` in core now supports typed `getAtlasView()` contributions (preferred) while keeping `getAtlasUI()` compatibility.
  - In-repo Atlas-producing plugins now use `getAtlasView()`.
  - `plugin-scaffold --hooks` now scaffolds `getAtlasView()` stub.
  - `frontend-usage`, `migration-audit` (including detail pages), `depgraph`, `logs` viewer page, and `migration-studio` page now render via shared `@sbtools/ui-web`.

  ### Fixed

  - `migration-studio` import-map ordering issue that caused bare module specifier resolution failures in browser (`@codemirror/state` not remapped).

  ### Docs

  - Updated VitePress docs and skill files for `getAtlasView()` guidance and new `@sbtools/ui-web` architecture.
  - Updated architecture dependency docs to include `@sbtools/ui-web` and current package count.

- 4b39da0: Implement UI Dashboard overhaul per ui-modernization-plan.md.

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

- 4b39da0: Implement UI deep modernization plan: Details page fix, shared tokens, ValueRenderer, Tooltip, icons.

  **SDK**

  - Add optional `primaryKeyField` to `DashboardSectionDef` for section-aware detail lookup

  **ui-web**

  - Fix Details page 404 for dependency_graph: use buildGraphModel nodes for lookup, render node-centric view with connected edges
  - Add `findDetailTarget`, `getSectionPrimaryKeyField`; update `getPrimaryKey` to accept optional `primaryKeyField`
  - Add `buildSearchIndex` support for dependency_graph (nodes as search hits) and optional sections for primaryKeyField
  - Extract shared tokens: `SHARED_TOKENS_CSS`, `SHARED_TOKENS_DARK` in `shared-tokens.ts`; document.tsx and plugin-migration-studio consume them
  - Add `ValueRenderer`: collapsible JSON tree, SQL keyword highlighting, format auto-detection; integrate in Details and GenericSection
  - Add `Tooltip` component; apply to theme toggle
  - Add `IconInfo`, `IconAlert`, `IconCheck`, `IconX`
  - Add search popover fade-in animation

  **plugin-migration-studio**

  - Import and use `SHARED_TOKENS_DARK` from ui-web; remove duplicate token definitions

- 4b39da0: Unify UI design system across dashboard, SSR pages, and Migration Studio.

  **ui-web**

  - Rewrite `tokens.css`: modern neutral scale (slate/zinc), indigo accent palette, secondary teal, remove blue/green gradients and glassmorphism
  - Reduce border overload: use `--border-subtle` (0.05 opacity) for most elements
  - Reduce radius (12px max panels, 8px cards/inputs)
  - Widen layout: remove `max-width: 1400px`, sidebar 240px, fluid padding
  - Add styles for StatCard, Badge, CardGrid, ExpandableCard, GenericSection, DataTable, CodeBlock
  - Align `document.tsx` baseCss to same tokens and Sora/IBM Plex Mono fonts
  - Add `.dark` support to SSR baseCss

  **plugin-migration-studio**

  - Align `styles.ts` to dashboard dark tokens (same vars, no radial gradients)
  - Solid backgrounds, softer borders, flat accent buttons
