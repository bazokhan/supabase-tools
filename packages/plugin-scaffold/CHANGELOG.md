# @sbtools/plugin-scaffold

## 0.6.0

### Minor Changes

- 4b39da0: Remove legacy Atlas UI code (Phase 5 of ui-modernization-plan.md).

  **Breaking**

  - **SDK**: Remove `getAtlasView`, `PluginAtlasView`, `buildAtlasUI`, `AtlasSectionDef`, `AtlasCardDef`, `AtlasBadgeDef`, `AtlasDetailDef`, `AtlasSummaryDef`
  - **Core**: Remove `sbt atlas-html` command and entire `src/atlas/` directory (12 files). Remove `atlas` subcommand from `sbt docs`.
  - **Plugins**: Remove `getAtlasView`, `atlas.ts`, and `atlas/styles.ts` from depgraph, frontend-usage, logs, migration-audit, deno-functions.

  **Replacement**

  Use `sbt dashboard` instead of `sbt atlas-html`. Plugins contribute via `getDashboardView()` (JSON-serializable config). The dashboard aggregates `backend-atlas-data.json` and displays all plugin sections.

### Patch Changes

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
  - @sbtools/sdk@0.6.0

## 0.5.0

### Patch Changes

- 4cc1277: # Scaffold: fix SDK dependency for internal and external plugins

  - **Internal plugins**: Use `workspace:*` instead of hardcoded `^0.1.0`.
  - **External plugins**: Use npm version (e.g. `^0.3.0`) instead of `file:../supabase-tools/packages/sdk`, which assumed a sibling supabase-tools directory and rarely applied.
  - **Dynamic version**: Resolve SDK version from `packages/sdk/package.json` when available; fallback to scaffold's own dependency or `^0.3.0`.

- 4cc1277: Versioned artifacts: foundational SDK, core, and migration-audit adoption

  **SDK**: Add artifact envelope types, validation helpers, read/write APIs (`writeArtifact`, `readArtifact`, `readArtifactOrNull`), and plugin contract extension (`ArtifactCapabilities`, `artifactsDir` in `PluginContext`). `writeArtifact` validates envelopes before writing.

  **Core**: Ensure `.sbt/artifacts/` directory, inject `artifactsDir` into plugin context. Auto-add `.sbt/` to `.gitignore` on init. Change `projectRoot` resolution to walk up from `cwd` looking for `supabase-tools.config.json` (handles symlinked packages).

  **plugin-migration-audit**: Produce `migration.analysis` artifact (v1.0.0) on every audit run via command hook (not `getAtlasData`/`getStatusLines` to avoid redundant writes); add `artifactCapabilities`; fix version drift (0.1.0 → 0.4.0 to match package.json).

  **plugin-scaffold**: Add commented `artifactCapabilities` template in generated plugin index.

  **Docs**: Add architecture section with artifact registry, contract guide, and compatibility policy.

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

- Updated dependencies [e05782b]
  - @sbtools/sdk@0.2.0
