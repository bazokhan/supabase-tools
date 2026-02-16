# @sbtools/plugin-erd

## 0.5.0

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
