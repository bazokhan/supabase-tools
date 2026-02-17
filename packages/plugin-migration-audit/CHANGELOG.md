# @sbtools/plugin-migration-audit

## 0.6.0

### Minor Changes

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

### Patch Changes

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

- 4cc1277: Versioned artifacts: foundational SDK, core, and migration-audit adoption

  **SDK**: Add artifact envelope types, validation helpers, read/write APIs (`writeArtifact`, `readArtifact`, `readArtifactOrNull`), and plugin contract extension (`ArtifactCapabilities`, `artifactsDir` in `PluginContext`). `writeArtifact` validates envelopes before writing.

  **Core**: Ensure `.sbt/artifacts/` directory, inject `artifactsDir` into plugin context. Auto-add `.sbt/` to `.gitignore` on init. Change `projectRoot` resolution to walk up from `cwd` looking for `supabase-tools.config.json` (handles symlinked packages).

  **plugin-migration-audit**: Produce `migration.analysis` artifact (v1.0.0) on every audit run via command hook (not `getAtlasData`/`getStatusLines` to avoid redundant writes); add `artifactCapabilities`; fix version drift (0.1.0 → 0.4.0 to match package.json).

  **plugin-scaffold**: Add commented `artifactCapabilities` template in generated plugin index.

  **Docs**: Add architecture section with artifact registry, contract guide, and compatibility policy.

### Patch Changes

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

- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
  - @sbtools/sdk@0.5.0

## 0.4.0

### Minor Changes

- ec82816: New plugin: migration audit. Read-only analysis comparing migration files on disk with app_migrations.schema_migrations. Detects drift, reports via CLI, JSON, HTML, and Backend Atlas integration.
