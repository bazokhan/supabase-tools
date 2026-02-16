# @sbtools/plugin-deno-functions

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
