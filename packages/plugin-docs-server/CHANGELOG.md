# @sbtools/plugin-docs-server

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

- Updated dependencies [e05782b]
  - @sbtools/sdk@0.2.0
