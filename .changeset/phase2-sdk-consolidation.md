---
"@sbtools/sdk": minor
"@sbtools/core": patch
"@sbtools/plugin-depgraph": patch
"@sbtools/plugin-migration-audit": patch
"@sbtools/plugin-docs-server": patch
---

# Phase 2: SDK consolidation (refactoring plan)

## SDK

- **2A** `loadPackageVersion(import.meta.url)` — applied to plugin-migration-audit and plugin-docs-server (removes createRequire boilerplate).
- **2E** `createArtifactWriter()` — factory for artifact envelope construction; reduces boilerplate in plugins.
- **2F** `snapshotFileHeader()` — shared template for snapshot file headers; all 7 core generators use it.
- Exports `CreateArtifactWriterOpts`, `WriteArtifactOpts`.

## Core

- All generators (functions, enums, types, triggers, views, policies) use `snapshotFileHeader` from SDK instead of inline header strings.

## Plugins

- **plugin-depgraph**: Import `AtlasData`, `FunctionItem`, `TriggerItem`, `PolicyItem`, `ViewItem`, `EnumItem`, `TypeItem` from SDK instead of re-declaring.
- **plugin-migration-audit**: Use `MigrationFileInfo` and `MigrationSqlAnalysis` from SDK; use `createPgClient`, `testConnection`, `disconnectClient` from SDK directly; remove pass-through wrappers from db-client.
- **plugin-docs-server**: Use `loadPackageVersion()` instead of createRequire.
