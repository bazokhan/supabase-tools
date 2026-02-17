# @sbtools/plugin-typegen

## 0.6.0

### Patch Changes

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
