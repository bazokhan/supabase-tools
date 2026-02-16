# @sbtools/core

## 0.5.0

### Minor Changes

- 4cc1277: Versioned artifacts: foundational SDK, core, and migration-audit adoption

  **SDK**: Add artifact envelope types, validation helpers, read/write APIs (`writeArtifact`, `readArtifact`, `readArtifactOrNull`), and plugin contract extension (`ArtifactCapabilities`, `artifactsDir` in `PluginContext`). `writeArtifact` validates envelopes before writing.

  **Core**: Ensure `.sbt/artifacts/` directory, inject `artifactsDir` into plugin context. Auto-add `.sbt/` to `.gitignore` on init. Change `projectRoot` resolution to walk up from `cwd` looking for `supabase-tools.config.json` (handles symlinked packages).

  **plugin-migration-audit**: Produce `migration.analysis` artifact (v1.0.0) on every audit run via command hook (not `getAtlasData`/`getStatusLines` to avoid redundant writes); add `artifactCapabilities`; fix version drift (0.1.0 → 0.4.0 to match package.json).

  **plugin-scaffold**: Add commented `artifactCapabilities` template in generated plugin index.

  **Docs**: Add architecture section with artifact registry, contract guide, and compatibility policy.

### Patch Changes

- 4cc1277: # Migrate: semicolon handling and skip double-wrap

  - **Missing semicolon** — If a migration file does not end with `;`, one is appended before `COMMIT;` so psql parses statements correctly (fixes "syntax error at or near COMMIT").
  - **Skip double-wrap** — If a migration already starts with `BEGIN;` (e.g. from "Wrap in transaction" in Migration Studio), migrate no longer wraps it again to avoid nested transaction issues.

- 4cc1277: # Migrate: wrap each migration in a transaction

  `psql` runs in autocommit mode when reading from stdin, so each statement committed independently. A migration file with multiple statements could partially apply: the first statement committed, the second failed, and the migration was never recorded in `schema_migrations`.

  Now each migration file is wrapped in `BEGIN;` and `COMMIT;`. If any statement fails, the entire migration rolls back and nothing is committed.

  **Note:** Migrations using `CREATE INDEX CONCURRENTLY` (which cannot run inside a transaction) will fail. Use a separate migration file for CONCURRENTLY operations or run them manually.

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

- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
  - @sbtools/sdk@0.5.0

## 0.3.0

### Minor Changes

- a6008c6: - SDK: Add `sanitizeContainerPrefix`, `deriveContainerPrefix`, `extractSupabaseKeys`, `sanitizeSlug`, `sanitizeIdentifier`; add compose/container/fs-utils tests
  - Core: Remove `docs` command from core (now provided by plugin-docs-server); `stop` no longer stops docs compose stack; use SDK container/compose utilities
  - plugin-docs-server: Add `docs` command with subcommands (swagger, redoc, atlas, schemaspy, all, stop); per-subcommand preflight
  - Plugins: Use shared SDK utilities; improved error handling (SbtError with tips); remove redundant root index.ts
  - Docs: Fix extractSupabaseKeys typo; clarify start/stop/restart operate on main stack; document plugin-docs-server requirement for docs commands

### Patch Changes

- Updated dependencies [a6008c6]
  - @sbtools/sdk@0.3.0

## 0.2.0

### Minor Changes

- e05782b: Decouple plugin-specific config from core; add `ctx.paths` for shared infrastructure

  **Breaking (0.1.0):**

  - `ctx.functionsPath` and `ctx.docsOutput` removed from `PluginContext` — use `ctx.paths.functions` and `ctx.paths.docsOutput`
  - `erdOutput`, `typesOutput` removed from root config `paths` — configure in `plugins[].config`
  - `paths.tests` removed from root config — configure `testsDir` in plugin-db-test's `plugins[].config`
  - `erd` section removed from root config — configure `displayColumns` in plugin-erd's `plugins[].config`

  Core now only owns shared infrastructure paths (migrations, snapshot, docsOutput, functions). Plugins own their specific config via `pluginConfig`. Community plugins can manage their own settings without modifying core.

### Patch Changes

- Updated dependencies [e05782b]
  - @sbtools/sdk@0.2.0
