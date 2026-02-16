# @sbtools/plugin-migration-studio

## 0.5.0

### Minor Changes

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

- 4cc1277: # Migration Studio Real-Time Validation

  Adds PostgreSQL syntax validation to protect users before save/apply.

  ## New

  - **POST /api/validate** — Runs SQL in BEGIN/ROLLBACK transaction. Returns `{ valid, error?, line?, dbConnected }`. Degrades gracefully when DB unreachable.
  - **Save guard** — Validates before writing; blocks save on syntax error with line number.
  - **Analysis panel** — Shows validation errors (red) and "Validation unavailable" (amber) when DB disconnected.
  - **Inline lint** — @codemirror/lint integration; squiggly underline on invalid SQL with PostgreSQL error message.
  - **Function template** — New "Create function returning text" template with correct `RETURNS text` and `RETURN '...'` inside `$$`.

  ## Dependencies

  - Added `@codemirror/lint` for diagnostics.

### Patch Changes

- 4cc1277: # Migration Studio: save-overwrite, dry run, wrap in transaction

  - **Update pending migration** — When a pending migration is loaded from the sidebar, Save becomes "Update migration" and overwrites that file instead of always creating a new one. "Save as new" creates a new file when editing an existing migration.
  - **Dry run** — Validates SQL using the same formatting as `sbt migrate` (transaction wrap, semicolon handling), so dry run accurately predicts apply success.
  - **Wrap in transaction** — Button wraps selected (or full) SQL in `BEGIN;` and `COMMIT;`.

- 4cc1277: # Security: address CodeQL / github-advanced-security findings

  - **plugin-migration-studio**: Validate handler is a function before invoking (CodeQL: unvalidated dynamic method call).
  - **sdk**: Replace ReDoS-vulnerable block comment regex in sql-analyzer with linear-time pattern (CodeQL: polynomial regular expression on uncontrolled data).

- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
- Updated dependencies [4cc1277]
  - @sbtools/sdk@0.5.0
