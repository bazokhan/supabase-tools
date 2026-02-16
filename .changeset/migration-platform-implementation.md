---
"@sbtools/sdk": minor
"@sbtools/core": patch
"@sbtools/plugin-migration-audit": minor
"@sbtools/plugin-migration-studio": minor
---

# Migration Platform Implementation

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
