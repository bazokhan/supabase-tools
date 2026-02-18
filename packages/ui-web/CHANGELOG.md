# @sbtools/ui-web

## 0.6.1

### Patch Changes

- 0e6989a: Add CLI runner page: invoke any sbt command from the dashboard and stream live output.

  **@sbtools/core**

  - `/api/commands`: returns all registered core + plugin commands (name, description, category, source)
  - `/api/run/stream`: SSE endpoint that spawns the `sbt` binary with the requested command, streams stdout/stderr line-by-line, and sends an exit event with the final code; kills the child process when the client disconnects
  - `findSbtBin()`: resolves `node_modules/.bin/sbt` locally before falling back to PATH
  - `collectCommands()`: merges core registry commands with plugin-contributed commands; filters blocked commands (`dashboard`, `docs`, `init`)

  **@sbtools/ui-web**

  - `Runner.tsx`: commands page grouped by category; run/cancel per command; live scrolling log surface with stdout/stderr coloring; ✓/✗ exit status pill; "Modifies DB" and "Runs until cancelled" badges
  - `useCommands` hook: fetches `/api/commands`, returns `{ commands, loading, error }`
  - `IconTerminal`: new terminal window icon
  - Nav: "Commands" entry with `IconTerminal`, always enabled, works without atlas data
  - CSS: `.runner-page`, `.run-card`, `.run-log-surface`, `.run-status-*`, `.btn-primary-sm`, `.btn-danger-sm`, `@keyframes blink` cursor

- 0e6989a: Refine dashboard UX across dependency graph, frontend usage, logs, and shared table/details components.

  - Improve `/depgraph` interactions:
    - subset relayout for focused/filtered nodes
    - clearer node selection/deselection and reset controls
    - directional edges with arrowheads and relationship labels
    - improved node details presentation and spacing
  - Improve `/frontend-usage`:
    - add filter-driven tabbed analysis views (hot components, component map, resource impact)
    - reduce header footprint to prioritize data table real estate
    - improve chart label usability (wider axis labels + full names in tooltip)
  - Simplify `/logs` header by removing non-essential intro copy.
  - Update shared dashboard UI behaviors/styles used by new views and interactions.

- 0e6989a: Improve dependency graph usability in the dashboard with focus-depth controls, palette presets, and quick structural filters.

  **@sbtools/plugin-depgraph**

  - Extend `dependency_graph` atlas category payload with additive `nodes` array (`id`, `label`, `type`, `schema`) for richer graph consumers.
  - Keep existing `edges` payload unchanged for backward compatibility.

  **@sbtools/ui-web**

  - Upgrade `/depgraph` page controls:
    - Focus toggle with selectable depth (`0..4`) from selected node
    - Palette selector with built-in presets (`Default`, `Colorblind-safe`, `High contrast`, `Muted`)
    - Quick filters: orphan-only, type multi-select, and connection-count buckets
  - Use payload `nodes` when available and fall back to edge-derived nodes for older depgraph outputs.
  - Add depgraph-specific UI styles for filter controls, chips, legend, and visibility counters.

- 0e6989a: Move Migration Studio to a server-only plugin + React dashboard page architecture.

  - Refactor `@sbtools/plugin-migration-studio` to server-only mode and remove bundled studio UI dependency on `@sbtools/ui-web`.
  - Add CORS and `GET /api/health` to the studio server to support browser clients from dashboard origin.
  - Add a first-class React `Migration Studio` dashboard page in `@sbtools/ui-web` with server URL config, connectivity status, templates, migration list/schema tabs, SQL actions (analyze/save/apply), and live refresh via SSE.
  - Wire dashboard navigation and plugin availability gating using plugin-contributed dashboard section metadata.

- 95f9e14: UI improvements: ERD dashboard integration, collapsible sidebar, Geist font, charts, sorting, accessibility, and style polish.

  **@sbtools/core**

  - Fix ERD fallback path: `resolveErdDir()` reads `plugin-erd` config to find the correct `erdOutput` directory instead of hardcoding `docsOutput/entity-relations`
  - Serve `dependency-graph.html` and `migration-audit.html` directly from `docsOutput`

  **@sbtools/plugin-erd**

  - Add `getAtlasData()`: reads generated `.md` files and contributes `erd_diagrams` category to atlas data
  - Add `getDashboardView()`: declares ERD section for the React SPA

  **@sbtools/plugin-migration-studio**

  - Replace hardcoded `#6366f1` with `var(--accent-hover)`, `#09090b` with `var(--bg)`
  - Align button `border-radius` to `var(--radius-md)`
  - Replace `.badge-applied/.badge-pending/.badge-missing` text classes with full badge styling
  - Add migration stat summary cards (Total, Applied, Pending, Missing)

  **@sbtools/ui-web**

  - ERD page (`Erd.tsx`, `MermaidRenderer.tsx`): renders Mermaid diagrams with search and raw source toggle
  - Collapsible sidebar: icon-only 56px collapsed state, `‹`/`›` toggle, persisted via localStorage
  - Font: replace Sora + IBM Plex Mono with Geist + Geist Mono across SPA and SSR pages
  - Charts: `MiniBarChart` (Overview entity counts), `MiniDonutChart` (Migrations applied/pending/missing)
  - Loading: `ShellLoadingSkeleton` replaces plain text loading state
  - Dropdown component: used for multi-action header buttons (Migrations, Depgraph)
  - EmptyState component: unified empty state replacing ad-hoc `<p class="empty-state">` usage
  - AppDataTable + DataTable: sortable columns, 50-row pagination, column resize handles, Badge for status/type fields, ValueRenderer with compact prop
  - Overview: StatCard with click-to-filter, tab overflow Dropdown at 12+ tabs, MiniBarChart
  - Details: graph node detail redesign with metadata grid, inbound/outbound edge tables, Badge for node type
  - Depgraph: wheel zoom, mouse-drag pan, zoom reset controls
  - Logs: responsive height (`calc(100vh - 320px)`), Badge for connection status
  - Search: Ctrl+K hotkey, arrow key navigation, Enter to select, clear on navigate, click-outside to close, Ctrl+K trailing badge
  - Accessibility: skip link, ARIA labels on nav/search/theme toggle, graph node keyboard support (`tabIndex`, Enter/Space)
  - Icons: IconTable, IconFunction, IconView, IconTrigger, IconPolicy, IconKey, IconEnum, IconType, IconErd, IconChart, IconCopy, IconExpand, IconFilter — used in search results, detail headers, section nav
  - SSR: move chip-bar, toolbar, tab, log-wrap patterns into `baseCss`; remove inline `pageCss` from `migration-audit` and `logs-viewer` renderers
  - Responsive: mobile hamburger + backdrop overlay, stat grid 2-col at 480px, detail grid 1-col at 640px, table horizontal scroll shadow
  - Transitions: theme color fade, sidebar width, route fade-in
  - CSS tokens: `shared-tokens.css` as single source; `tokens.css` imports it

- 95f9e14: Implement UI Improvement Plan items: CSS token deduplication, SSR renderer cleanup, responsive layout polish

  - **§1 CSS Architecture**: Add `generate:tokens` script to sync `shared-tokens.ts` → `shared-tokens.css` at build time; shared-tokens.ts is now the single canonical source; add `--surface-alt` to `.dark` for parity with SHARED_TOKENS_DARK
  - **§2 SSR Renderer Cleanup**: migration-audit uses standard `.tab-row` / `.tab-btn` instead of `.chipbar`; add `.table-scroll-wrap` with horizontal scroll fade; apply to migration-audit, depgraph, frontend-usage, logs-viewer tables
  - **§3 Responsive Layout**: Hamburger menu moved into topbar at mobile widths with `IconMenu`; stat grid 480px / detail grid 640px breakpoints; table scroll indicator on all SSR tables

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
