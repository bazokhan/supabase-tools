---
"@sbtools/ui-web": minor
"@sbtools/sdk": minor
"@sbtools/core": minor
"@sbtools/plugin-depgraph": minor
"@sbtools/plugin-migration-audit": minor
"@sbtools/plugin-frontend-usage": minor
"@sbtools/plugin-logs": minor
"@sbtools/plugin-migration-studio": minor
"@sbtools/plugin-deno-functions": patch
"@sbtools/plugin-scaffold": patch
---

Centralize browser UI rendering through the new shared `@sbtools/ui-web` package and migrate plugin/core HTML generators away from large page-local template strings.

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
