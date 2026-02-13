# @sbtools/sdk

## 0.3.0

### Minor Changes

- a6008c6: - SDK: Add `sanitizeContainerPrefix`, `deriveContainerPrefix`, `extractSupabaseKeys`, `sanitizeSlug`, `sanitizeIdentifier`; add compose/container/fs-utils tests
  - Core: Remove `docs` command from core (now provided by plugin-docs-server); `stop` no longer stops docs compose stack; use SDK container/compose utilities
  - plugin-docs-server: Add `docs` command with subcommands (swagger, redoc, atlas, schemaspy, all, stop); per-subcommand preflight
  - Plugins: Use shared SDK utilities; improved error handling (SbtError with tips); remove redundant root index.ts
  - Docs: Fix extractSupabaseKeys typo; clarify start/stop/restart operate on main stack; document plugin-docs-server requirement for docs commands

## 0.2.0

### Minor Changes

- e05782b: Decouple plugin-specific config from core; add `ctx.paths` for shared infrastructure

  **Breaking (0.1.0):**

  - `ctx.functionsPath` and `ctx.docsOutput` removed from `PluginContext` — use `ctx.paths.functions` and `ctx.paths.docsOutput`
  - `erdOutput`, `typesOutput` removed from root config `paths` — configure in `plugins[].config`
  - `paths.tests` removed from root config — configure `testsDir` in plugin-db-test's `plugins[].config`
  - `erd` section removed from root config — configure `displayColumns` in plugin-erd's `plugins[].config`

  Core now only owns shared infrastructure paths (migrations, snapshot, docsOutput, functions). Plugins own their specific config via `pluginConfig`. Community plugins can manage their own settings without modifying core.
