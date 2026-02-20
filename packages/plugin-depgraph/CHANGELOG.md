# @sbtools/plugin-depgraph

## 0.8.0

### Patch Changes

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

### Patch Changes

- Updated dependencies [65add92]
  - @sbtools/ui-web@0.7.0

## 0.6.1

### Patch Changes

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

- Updated dependencies [0e6989a]
- Updated dependencies [0e6989a]
- Updated dependencies [0e6989a]
- Updated dependencies [0e6989a]
- Updated dependencies [95f9e14]
- Updated dependencies [95f9e14]
  - @sbtools/ui-web@0.6.1

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

- 4cc1277: Wave 4: Artifact producers and docs-server consumer

  **plugin-deno-functions**: Produce `openapi.partial.deno-functions` (v1.0.0) artifact when edge functions are extracted (command + `getAtlasData` hooks only; skip `getOpenApiSpec`/`getStatusLines` to avoid redundant writes). Add `artifactCapabilities`.

  **plugin-docs-server**: Consume `openapi.partial.deno-functions` artifact when merging OpenAPI specs; prefer artifact over `getOpenApiSpec` for deterministic merge order. Add `artifactCapabilities`.

  **plugin-depgraph**: Produce `depgraph.graph` (v1.0.0) artifact when graph is built (command hook only; skip `getAtlasData`/`getStatusLines` to avoid redundant writes). Add `artifactCapabilities`.

  **plugin-frontend-usage**: Produce `frontend.usage` (v1.0.0) artifact when scan completes (command hook only; skip `getAtlasData`/`getStatusLines` to avoid redundant writes). Add `artifactCapabilities`.

  **All artifact producers**: Use `PLUGIN_VERSION` constant to ensure `meta.toolVersion` matches plugin version field (fixes version drift risk).

  **Docs**: Update artifact registry with `openapi.partial.deno-functions`, `depgraph.graph`, `frontend.usage` status; set `migration.analysis` to Active.

### Patch Changes

- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
  - @sbtools/sdk@0.5.0

## 0.3.0

### Patch Changes

- Updated dependencies [a6008c6]
  - @sbtools/sdk@0.3.0

## 0.2.0

### Patch Changes

- e05782b: Decouple plugin-specific config from core; add `ctx.paths` for shared infrastructure

  **Breaking (0.1.0):**

  - `ctx.functionsPath` and `ctx.docsOutput` removed from `PluginContext` — use `ctx.paths.functions` and `ctx.paths.docsOutput`
  - `erdOutput`, `typesOutput` removed from root config `paths` — configure in `plugins[].config`
  - `paths.tests` removed from root config — configure `testsDir` in plugin-db-test's `plugins[].config`
  - `erd` section removed from root config — configure `displayColumns` in plugin-erd's `plugins[].config`

  Core now only owns shared infrastructure paths (migrations, snapshot, docsOutput, functions). Plugins own their specific config via `pluginConfig`. Community plugins can manage their own settings without modifying core.

- Updated dependencies [e05782b]
  - @sbtools/sdk@0.2.0
