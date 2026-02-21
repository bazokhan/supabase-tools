# @sbtools/core

## 0.9.0

### Minor Changes

- c2c54f5: Default all generated output paths to `.sbt/` (git-ignored)

  Previously, `snapshot` defaulted to `supabase/current` and `docsOutput` to `docs`, causing
  generated files to be tracked by git unless users explicitly overrode them.

  Both now default to `.sbt/snapshot` and `.sbt/docs` respectively — already inside the
  git-ignored `.sbt/` directory. `migrations` and `functions` are unchanged (user-authored files
  that should be committed).

  `plugin-typegen` type output now defaults to `.sbt/types/supabase.ts` instead of
  `src/integrations/supabase/types.ts`.

  Users with explicit path overrides in `supabase-tools.config.json` are unaffected.

### Patch Changes

- Updated dependencies [c2c54f5]
  - @sbtools/ui-web@0.9.0

## 0.8.0

### Patch Changes

- 00287ca: Improve first-run dashboard usability and operations visibility.

  - Allow operational routes (Migration Studio, Commands, Plugins, Services) to render even when atlas data is missing.
  - Add dashboard plugin management APIs and UI for add/enable/disable/remove with install/load status visibility.
  - Add command prerequisite and runtime-state metadata so runner buttons are status-aware and prevent duplicate singleton launches.
  - Add Services page with Docker status plus reachable local UI endpoints (Supabase Studio, docs UIs, migration studio).

- Updated dependencies [00287ca]
- Updated dependencies [00287ca]
- Updated dependencies [00287ca]
- Updated dependencies [00287ca]
- Updated dependencies [00287ca]
- Updated dependencies [00287ca]
- Updated dependencies [00287ca]
  - @sbtools/ui-web@0.8.0
  - @sbtools/sdk@0.8.0

## 0.7.0

### Minor Changes

- 65add92: Improve first-run onboarding experience

  **`@sbtools/core`**

  - feat: global preflight check — every command except `init` and `help` now exits immediately with a clear `❌` error and `💡` tip if `supabase-tools.config.json` is missing, instead of crashing with an opaque internal error
  - fix: `sbt init` now creates `supabase/migrations` and `supabase/current` directories so `sbt migrate` preflight passes immediately after init
  - feat: `sbt init` prints a "Next steps" guide after creating a new config
  - feat: `sbt help` shows a warning banner and Quick Start sequence when no config file is present
  - feat: new `sbt plugin` command with subcommands `list`, `add`, `remove`, `enable`, `disable` for managing plugins without manually editing JSON
  - feat: `sbt start` prints a note explaining that the `db-init` container exiting with code 0 is normal

  **`@sbtools/ui-web`**

  - fix: dashboard Getting Started guide now correctly triggers on a 404 response (was checking for "not found" but the error message contains the status code)

### Patch Changes

- Updated dependencies [65add92]
  - @sbtools/ui-web@0.7.0

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

- Updated dependencies [0e6989a]
- Updated dependencies [0e6989a]
- Updated dependencies [0e6989a]
- Updated dependencies [0e6989a]
- Updated dependencies [95f9e14]
- Updated dependencies [95f9e14]
  - @sbtools/ui-web@0.6.1

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

- 4b39da0: # Phase 5: Merge plugin-docs-server and plugin-atlas-html into core

  **Breaking**: Remove `@sbtools/plugin-docs-server` and `@sbtools/plugin-atlas-html` from your `supabase-tools.config.json` plugins array. The `docs` and `atlas-html` commands are now built into `@sbtools/core`.

  ## Core changes

  - **docs command**: Moved from plugin-docs-server into core. Starts Swagger UI, ReDoc, Backend Atlas, and SchemaSpy via Docker Compose. No plugin required.
  - **atlas-html command**: Moved from plugin-atlas-html into core. Generates Backend Atlas HTML from `backend-atlas-data.json`. No plugin required.
  - **buildCoreContext()**: Core commands that need plugin access (e.g. docs for OpenAPI merge, atlas-html for UI contributions) receive a context with `siblingPlugins`.
  - **Command registry**: `run` now accepts optional second parameter `ctx` for commands that need plugin integration.

  ## Migration

  1. Remove from `supabase-tools.config.json` plugins:
     - `{ "path": "@sbtools/plugin-docs-server" }`
     - `{ "path": "@sbtools/plugin-atlas-html" }`
  2. Uninstall (optional): `npm uninstall @sbtools/plugin-docs-server @sbtools/plugin-atlas-html`
  3. Commands `sbt docs` and `sbt atlas-html` continue to work identically.

  Package count: 14 → 12 (sdk + core + 10 plugins).

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

- 4b39da0: Remove legacy Atlas UI code (Phase 5 of ui-modernization-plan.md).

  **Breaking**

  - **SDK**: Remove `getAtlasView`, `PluginAtlasView`, `buildAtlasUI`, `AtlasSectionDef`, `AtlasCardDef`, `AtlasBadgeDef`, `AtlasDetailDef`, `AtlasSummaryDef`
  - **Core**: Remove `sbt atlas-html` command and entire `src/atlas/` directory (12 files). Remove `atlas` subcommand from `sbt docs`.
  - **Plugins**: Remove `getAtlasView`, `atlas.ts`, and `atlas/styles.ts` from depgraph, frontend-usage, logs, migration-audit, deno-functions.

  **Replacement**

  Use `sbt dashboard` instead of `sbt atlas-html`. Plugins contribute via `getDashboardView()` (JSON-serializable config). The dashboard aggregates `backend-atlas-data.json` and displays all plugin sections.

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

- 4b39da0: **Documentation:** Update VitePress docs to reflect refactoring changes — add `buildAtlasUI()`, `SchemaFilter`, `loadPackageVersion()`, and `withHelp()` to SDK docs; update writing-plugins guide with recommended `buildAtlasUI()` pattern; correct package count and note merged packages in architecture docs.

  **Plugin loader:** Add graceful handling for `@sbtools/plugin-atlas-html` and `@sbtools/plugin-docs-server` — these packages were merged into core as of v0.3.0. The loader now detects them in config and prints a helpful warning instead of crashing.

  **Convention linter:** Add `scripts/lint-conventions.ts` with 10 rules enforcing project conventions (use `ui.*` instead of `console.log`, use `SbtError` subclasses, wrap commands with `withHelp()`, use `buildAtlasUI()`, parameterized schema filters, avoid separator comment banners, etc.). Run via `npm run lint:conventions` — emits advisory warnings only, does not fail builds.

- 4b39da0: # Phase 2: SDK consolidation (refactoring plan)

  ## SDK

  - **2A** `loadPackageVersion(import.meta.url)` — applied to plugin-migration-audit (removes createRequire boilerplate).
  - **2E** `createArtifactWriter()` — factory for artifact envelope construction; reduces boilerplate in plugins.
  - **2F** `snapshotFileHeader()` — shared template for snapshot file headers; all 7 core generators use it.
  - Exports `CreateArtifactWriterOpts`, `WriteArtifactOpts`.

  ## Core

  - All generators (functions, enums, types, triggers, views, policies) use `snapshotFileHeader` from SDK instead of inline header strings.

  ## Plugins

  - **plugin-depgraph**: Import `AtlasData`, `FunctionItem`, `TriggerItem`, `PolicyItem`, `ViewItem`, `EnumItem`, `TypeItem` from SDK instead of re-declaring.
  - **plugin-migration-audit**: Use `MigrationFileInfo` and `MigrationSqlAnalysis` from SDK; use `createPgClient`, `testConnection`, `disconnectClient` from SDK directly; remove pass-through wrappers from db-client.

- 4b39da0: Refactoring plan implementation: small gaps (withHelp, console.log), C5 (schema filter parameterized queries), 4G (Atlas UI builder).

  - **withHelp()** applied to plugin-db-test, plugin-typegen; core watch command
  - **ui.info** replaces console.log in plugin-logs viewer
  - **C5** — getSchemaFilter returns `{ clause, params }`; extractors use parameterized queries
  - **4G** — sdk/atlas-ui.ts builder; plugin-logs, deno-functions, depgraph, migration-audit, frontend-usage migrated; scaffold uses buildAtlasUI([])
  - Fixes D6 (DRY triad), C8 (escapeHtml implicit global)

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

- 4cc1277: Versioned artifacts: foundational SDK, core, and migration-audit adoption

  **SDK**: Add artifact envelope types, validation helpers, read/write APIs (`writeArtifact`, `readArtifact`, `readArtifactOrNull`), and plugin contract extension (`ArtifactCapabilities`, `artifactsDir` in `PluginContext`). `writeArtifact` validates envelopes before writing.

  **Core**: Ensure `.sbt/artifacts/` directory, inject `artifactsDir` into plugin context. Auto-add `.sbt/` to `.gitignore` on init. Change `projectRoot` resolution to walk up from `cwd` looking for `supabase-tools.config.json` (handles symlinked packages).

  **plugin-migration-audit**: Produce `migration.analysis` artifact (v1.0.0) on every audit run via command hook (not `getAtlasData`/`getStatusLines` to avoid redundant writes); add `artifactCapabilities`; fix version drift (0.1.0 → 0.4.0 to match package.json).

  **plugin-scaffold**: Add commented `artifactCapabilities` template in generated plugin index.

  **Docs**: Add architecture section with artifact registry, contract guide, and compatibility policy.

### Patch Changes

- 4cc1277: # Migrate: semicolon handling and skip double-wrap

  - **Missing semicolon** — If a migration file does not end with `;`, one is appended before `COMMIT;` so psql parses statements correctly (fixes "syntax error at or near COMMIT").
  - **Skip double-wrap** — If a migration already starts with `BEGIN;` (e.g. from "Wrap in transaction" in Migration Studio), migrate no longer wraps it again to avoid nested transaction issues.

- 4cc1277: # Migrate: wrap each migration in a transaction

  `psql` runs in autocommit mode when reading from stdin, so each statement committed independently. A migration file with multiple statements could partially apply: the first statement committed, the second failed, and the migration was never recorded in `schema_migrations`.

  Now each migration file is wrapped in `BEGIN;` and `COMMIT;`. If any statement fails, the entire migration rolls back and nothing is committed.

  **Note:** Migrations using `CREATE INDEX CONCURRENTLY` (which cannot run inside a transaction) will fail. Use a separate migration file for CONCURRENTLY operations or run them manually.

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

- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
  - @sbtools/sdk@0.5.0

## 0.3.0

### Minor Changes

- a6008c6: - SDK: Add `sanitizeContainerPrefix`, `deriveContainerPrefix`, `extractSupabaseKeys`, `sanitizeSlug`, `sanitizeIdentifier`; add compose/container/fs-utils tests
  - Core: Remove `docs` command from core (now provided by plugin-docs-server); `stop` no longer stops docs compose stack; use SDK container/compose utilities
  - plugin-docs-server: Add `docs` command with subcommands (swagger, redoc, atlas, schemaspy, all, stop); per-subcommand preflight
  - Plugins: Use shared SDK utilities; improved error handling (SbtError with tips); remove redundant root index.ts
  - Docs: Fix extractSupabaseKeys typo; clarify start/stop/restart operate on main stack; document plugin-docs-server requirement for docs commands

### Patch Changes

- Updated dependencies [a6008c6]
  - @sbtools/sdk@0.3.0

## 0.2.0

### Minor Changes

- e05782b: Decouple plugin-specific config from core; add `ctx.paths` for shared infrastructure

  **Breaking (0.1.0):**

  - `ctx.functionsPath` and `ctx.docsOutput` removed from `PluginContext` — use `ctx.paths.functions` and `ctx.paths.docsOutput`
  - `erdOutput`, `typesOutput` removed from root config `paths` — configure in `plugins[].config`
  - `paths.tests` removed from root config — configure `testsDir` in plugin-db-test's `plugins[].config`
  - `erd` section removed from root config — configure `displayColumns` in plugin-erd's `plugins[].config`

  Core now only owns shared infrastructure paths (migrations, snapshot, docsOutput, functions). Plugins own their specific config via `pluginConfig`. Community plugins can manage their own settings without modifying core.

### Patch Changes

- Updated dependencies [e05782b]
  - @sbtools/sdk@0.2.0
