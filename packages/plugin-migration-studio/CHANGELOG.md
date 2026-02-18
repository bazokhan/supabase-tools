# @sbtools/plugin-migration-studio

## 0.6.1

### Patch Changes

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

- 4b39da0: Add phase-1 real-time refresh for migration workflows.

  **core**:

  - Add `sbt watch` command to orchestrate migration refresh in near real time.
  - Watch migration files and listen to PostgreSQL `LISTEN/NOTIFY` events (`sbt_watch_events`).
  - Auto-install DB helper hooks for notifications (with graceful fallback for limited privileges).
  - Add debounced single-flight scheduling for refresh runs.
  - Write watch event stamp at `.sbt/watch/last-event.json`.
  - Fix watch self-loop by ignoring artifact file writes as watch triggers.

  **plugin-migration-studio**:

  - Add SSE endpoint (`GET /api/events`) for live refresh notifications.
  - Invalidate schema/migration caches on watch/artifact/file change bridge events.
  - Refresh schema/migration context in UI without full page reload.

### Patch Changes

- Updated dependencies [4b39da0]
- Updated dependencies [4b39da0]
- Updated dependencies [4b39da0]
- Updated dependencies [4b39da0]
- Updated dependencies [4b39da0]
- Updated dependencies [4b39da0]
- Updated dependencies [4b39da0]
- Updated dependencies [4b39da0]
- Updated dependencies [4b39da0]
  - @sbtools/ui-web@0.6.0
  - @sbtools/sdk@0.6.0

## 0.5.0

### Minor Changes

- 4cc1277: # Migration Platform Implementation

  Implements phases 0–5 of the Migration Platform Implementation Plan.

  ## SDK

  - **analyzeMigrationSql** — Regex-based SQL analyzer (DDL classification, risk flags, touched objects). Shared by migration-audit and migration-studio.
  - **Exports:** `analyzeMigrationSql`, `OperationKind`, `ParsedOperation`, `MigrationSqlAnalysis`

  ## plugin-migration-audit

  - **Migration analysis engine** — Per-migration SQL analysis with operation classifier (tables, functions, views, triggers, policies, extensions, types), safety/risk extraction (transaction, IF EXISTS, destructive, TRUNCATE), and parser confidence.
  - **Artifact** — `migration.analysis` v1.0.0 now includes `sqlAnalysis` per migration (operations, touchedObjectKeys, riskFlags, confidence).
  - **Migration detail explorer** — Detail HTML pages per migration with SQL viewer, operation chips, risk panel, touched objects. Links from main report and Atlas cards.
  - **Architecture hygiene** — Uses SDK `analyzeMigrationSql` (no local duplicate).

  ## plugin-migration-studio (new)

  - **migration-studio command** — Local HTTP server (port 3335) with browser UI.
  - **APIs:** `/api/analyze` (analyze SQL), `/api/save` (save migration file), `/api/apply` (run `sbt migrate` with confirmation).
  - **Apply path** — Invokes core `sbt migrate` via node dist/cli.js.

  ## Core

  - **Atlas collision warnings** — Warn when plugin categories (generate-data) or kindLabels (atlas-html) overwrite existing keys.

  ## Architecture hygiene (cross-package)

  - Normalized `@sbtools/*` in comments/docs (replaced `@sbt/`).
  - Plugin versions use `package.json` via `createRequire` (no hardcoded duplication).
  - **docs/architecture/implicit-file-contracts.md** — Documents output paths and merge semantics.

  ## Not included (phases 6–8)

  - Phase 4 (object staleness/lineage) — Deferred.
  - Phase 6 (template/low-code helpers) — Deferred.
  - Phase 7 (Atlas route manifest, dedupe) — Deferred.
  - Phase 8 (fixture tests, smoke tests) — Deferred.

- 4cc1277: # Migration Studio Overhaul

  Implements MIGRATION_STUDIO_OVERHAUL_PLAN.md.

  ## SDK

  - **db-utils.ts** — `resolveDbUrl`, `createPgClient`, `testConnection`, `disconnectClient`. Optional peer dep on `pg`.
  - **migration-scanner.ts** — `scanMigrationFiles`, `parseTimestampPrefix`, `MigrationFileInfo`.

  ## plugin-migration-audit

  - Import DB utils and migration scanner from SDK. Keep audit-specific queries locally.

  ## plugin-erd

  - Use SDK `createPgClient` and `disconnectClient` instead of inline Client setup.

  ## plugin-migration-studio

  - **Phase 1**: CodeMirror 6 editor (PostgreSQL dialect, one-dark theme), line numbers, bracket matching, keybindings. Refactored into `index.ts`, `server.ts`, `types.ts`, `html/editor-page.ts`, `html/styles.ts`.
  - **Phase 2**: Schema introspection (DB → atlas-data → artifact → none). `GET /api/schema`. Schema-aware autocomplete via CodeMirror `sql({ schema })`. Status indicator.
  - **Phase 3**: Live analysis (debounced 300ms on doc change). Analysis panel updates as you type.
  - **Phase 4**: Migration templates (8 templates). `GET /api/templates`. Template bar above editor.
  - **Phase 5**: Context sidebar (migrations + schema tabs). `GET /api/migrations`, `GET /api/migration/:filename`. Save with description prompt. Two-panel layout.

- 4cc1277: # Migration Studio Real-Time Validation

  Adds PostgreSQL syntax validation to protect users before save/apply.

  ## New

  - **POST /api/validate** — Runs SQL in BEGIN/ROLLBACK transaction. Returns `{ valid, error?, line?, dbConnected }`. Degrades gracefully when DB unreachable.
  - **Save guard** — Validates before writing; blocks save on syntax error with line number.
  - **Analysis panel** — Shows validation errors (red) and "Validation unavailable" (amber) when DB disconnected.
  - **Inline lint** — @codemirror/lint integration; squiggly underline on invalid SQL with PostgreSQL error message.
  - **Function template** — New "Create function returning text" template with correct `RETURNS text` and `RETURN '...'` inside `$$`.

  ## Dependencies

  - Added `@codemirror/lint` for diagnostics.

### Patch Changes

- 4cc1277: # Migration Studio: save-overwrite, dry run, wrap in transaction

  - **Update pending migration** — When a pending migration is loaded from the sidebar, Save becomes "Update migration" and overwrites that file instead of always creating a new one. "Save as new" creates a new file when editing an existing migration.
  - **Dry run** — Validates SQL using the same formatting as `sbt migrate` (transaction wrap, semicolon handling), so dry run accurately predicts apply success.
  - **Wrap in transaction** — Button wraps selected (or full) SQL in `BEGIN;` and `COMMIT;`.

- 4cc1277: # Security: address CodeQL / github-advanced-security findings

  - **plugin-migration-studio**: Validate handler is a function before invoking (CodeQL: unvalidated dynamic method call).
  - **sdk**: Replace ReDoS-vulnerable block comment regex in sql-analyzer with linear-time pattern (CodeQL: polynomial regular expression on uncontrolled data).

- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
  - @sbtools/sdk@0.5.0
