# @sbtools/sdk

Plugin SDK for supabase-tools — shared types, interfaces, and utilities.

## Installation

```bash
npm install @sbtools/sdk
```

## Usage

```ts
import { ui, SbtError, handleError } from "@sbtools/sdk";
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";
```

## API

- **SbtPlugin** — Plugin contract with `name`, `version`, `commands`, hooks
- **PluginContext** — Runtime context (`projectRoot`, `toolsDir`, `pluginConfig`, etc.)
- **ui** — CLI output helpers (`info`, `success`, `warn`, `step`, `table`, etc.)
- **Error classes** — `ConfigError`, `DatabaseError`, `SnapshotError`, `PluginError`, `SbtError`
- **Filesystem** — `ensureDir`, `readText`, `writeFileInDir`, `safeName`, `safeFileName`, `sanitizeSlug`, `sanitizeIdentifier`
- **Container** — `sanitizeContainerPrefix`, `deriveContainerPrefix` — Docker project prefix from config
- **Compose** — `extractComposeKey`, `extractSupabaseKeys` — Extract keys from docker-compose files
- **CLI** — `hasFlag`, `getArg`, `openFile`, `withHelp`, `loadPackageVersion`
- **Dashboard** — `DashboardView`, `DashboardSectionDef`, etc. — JSON-serializable plugin UI contributions for `sbt dashboard`
- **Schema** — `SchemaFilter` — Parameterized SQL filter type (`{ clause, params }`)

## Dependencies

None — pure utilities, no runtime dependencies.

See [SDK docs](https://bazokhan.github.io/supabase-tools/sdk/) for full reference.
