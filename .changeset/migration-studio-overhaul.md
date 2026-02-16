---
"@sbtools/sdk": minor
"@sbtools/plugin-migration-audit": patch
"@sbtools/plugin-erd": patch
"@sbtools/plugin-migration-studio": minor
---

# Migration Studio Overhaul

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
