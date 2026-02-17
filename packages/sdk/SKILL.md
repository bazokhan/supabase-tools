# @sbtools/sdk

## Purpose

Plugin SDK for supabase-tools — shared types, interfaces, utilities, and the plugin contract. Every plugin and core imports from this package.

## When to Use

Use this skill when the user needs to:
- Modify the plugin contract (`SbtPlugin`, `PluginContext`, hooks)
- Add or change Dashboard contribution types (`DashboardView`, `DashboardSectionDef`, etc.)
- Update shared data types (`AtlasData`, `FunctionItem`, `ViewItem`, etc.)
- Modify CLI utilities (`ui`, `hasFlag`, `getArg`, `openFile`, `withHelp`)
- Work with error classes (`SbtError`, `ConfigError`, etc.)
- Update filesystem or container utilities
- Change artifact read/write APIs
- Modify the SQL analyzer (shared by migration-audit and migration-studio)

## Architecture

Pure utilities and type definitions — zero runtime dependencies. Types are erased at compile time so there's no runtime coupling between SDK and consumers.

### Plugin Contract

`src/plugin-api.ts` — defines `SbtPlugin` (the shape plugins must export) and all hook interfaces:

| Hook | When Called | Returns |
|------|-----------|---------|
| `commands` | CLI dispatch | Array of `SbtPluginCommand` |
| `getAtlasData(ctx)` | `generate-atlas` | `PluginAtlasData` (categories + stats) |
| `getDashboardView()` | `sbt dashboard` | `DashboardView` (JSON-serializable sections) |
| `getStatusLines(ctx)` | `sbt status` | Extra info lines |
| `getOpenApiSpec(ctx)` | `sbt docs` | Partial OpenAPI 3.0 object |

### Dashboard Types

JSON-serializable declarative UI definitions: `DashboardSectionDef`, `DashboardCardDef`, `DashboardTableDef`, `DashboardStatDef`, etc. Plugins describe their dashboard UI via data — the SPA renders it.

## File Layout

```
sdk/
├── src/
│   ├── index.ts            # Re-exports everything
│   ├── types.ts            # Shared data types (AtlasData, FunctionItem, etc.)
│   ├── plugin-api.ts       # Plugin contract interfaces (zero runtime code)
│   ├── artifacts.ts        # Artifact read/write/validate helpers
│   ├── cli-utils.ts        # hasFlag, getArg, openFile, withHelp
│   ├── ui.ts               # Semantic CLI output (info, success, warn, step, table)
│   ├── errors.ts           # Error classes (SbtError, ConfigError, etc.)
│   ├── fs-utils.ts         # ensureDir, writeFileInDir, readText, safeName, etc.
│   ├── compose-utils.ts    # Docker Compose key extraction
│   ├── container-utils.ts  # Container prefix derivation
│   ├── db-utils.ts         # PostgreSQL client helpers (optional pg dependency)
│   ├── sql-analyzer.ts     # Migration SQL analysis (shared by audit + studio)
│   ├── migration-scanner.ts # Migration file discovery and timestamp parsing
│   ├── plugin-config.ts    # Typed config accessors (getConfigString, etc.)
│   ├── package-meta.ts     # loadPackageVersion
│   ├── constants.ts        # Shared constants (compose filenames)
│   └── templates.ts        # Shared templates (snapshot file header)
├── tests/
└── package.json
```

## Key Exports

- **Types**: `AtlasData`, `FunctionItem`, `ViewItem`, `TriggerItem`, `PolicyItem`, `TypeItem`, `EnumItem`, `SchemaFilter`, `SnapshotMeta`
- **Plugin API**: `SbtPlugin`, `SbtPluginCommand`, `PluginContext`, `ResolvedPaths`, `PluginAtlasData`, `DashboardView`, `DashboardSectionDef`, and related dashboard types
- **Artifacts**: `writeArtifact`, `readArtifact`, `readArtifactOrNull`, `createArtifactWriter`
- **CLI**: `hasFlag`, `getArg`, `openFile`, `withHelp`, `loadPackageVersion`, `ui`
- **Errors**: `SbtError`, `ConfigError`, `SnapshotError`, `DatabaseError`, `PluginError`, `handleError`
- **Filesystem**: `ensureDir`, `writeFileInDir`, `readText`, `safeName`, `safeFileName`, `sanitizeSlug`, `sanitizeIdentifier`
- **SQL**: `analyzeMigrationSql`, `scanMigrationFiles`, `parseTimestampPrefix`
- **DB**: `resolveDbUrl`, `createPgClient`, `testConnection`, `disconnectClient`
