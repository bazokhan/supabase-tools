---
description: SDK types, PluginContext, UI utilities, error classes, and helpers for building plugins.
---

# SDK API Reference

The `@sbtools/sdk` package provides shared types, interfaces, and utilities for supabase-tools plugins.

## Installation

```bash
npm install @sbtools/sdk
```

## Core Types

- **SbtPlugin** — Plugin contract with `name`, `version`, `commands`, and optional hooks
- **PluginContext** — Runtime context passed to every plugin hook:
  - `projectRoot`, `toolsDir`, `sbtDataDir` — absolute directory paths
  - `apiUrl` — Supabase API URL
  - `paths` — shared config paths resolved to absolute: `migrations`, `tests`, `snapshot`, `docsOutput`, `functions`
  - `pluginConfig` — plugin-specific config from `plugins[].config`
  - `siblingPlugins` — other loaded plugins for cross-plugin collaboration
- **ResolvedPaths** — Type for `ctx.paths`
- **SbtPluginCommand** — Command definition with `name`, `description`, `run`

## UI Utilities

```ts
import { ui } from "@sbtools/sdk";

ui.info("Message");
ui.success("Done");
ui.warn("Warning");
ui.error("Error");
ui.step("Step");
ui.detail("Detail");
ui.heading("Heading");
ui.table([["a", "b"], ["1", "2"]], 2);
```

## Error Classes

- `ConfigError` — Config validation failures
- `DatabaseError` — DB connection/query failures
- `SnapshotError` — Snapshot generation failures
- `PluginError` — Plugin load/hook failures
- `SbtError` — Generic CLI errors

Use `handleError(err)` for consistent error output.

## Helpers

- `ensureDir(path)` — Create directory
- `readText(path)` — Read file as UTF-8
- `writeFileInDir(dir, filename, content)` — Write file in directory
- `safeName(str)` — Sanitize for identifiers
- `safeFileName(str)` — Sanitize for filenames
- `hasFlag(args, name)` — Check for CLI flags
- `getArg(args, name)` — Get CLI argument value
- `extractComposeKey(path, regexes)` — Extract keys from docker-compose

## Building Plugins

See [plugin-scaffold](/plugins/plugin-scaffold) to scaffold a new plugin, or inspect existing plugins in the repository.
