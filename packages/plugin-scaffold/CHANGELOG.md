# @sbtools/plugin-scaffold

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
