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
- **Helpers** — `ensureDir`, `readText`, `writeFileInDir`, `safeName`, `safeFileName`, `hasFlag`, `getArg`, `extractComposeKey`

See [SDK docs](https://supabase-tools.github.io/supabase-tools/sdk/) for full reference.
