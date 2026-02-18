---
description: SDK types, PluginContext, UI utilities, error classes, container/compose utils, and helpers for building plugins.
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
  - `projectRoot`, `toolsDir`, `sbtDataDir`, `artifactsDir` — absolute directory paths
  - `apiUrl` — Supabase API URL
  - `paths` — shared config paths resolved to absolute: `migrations`, `snapshot`, `docsOutput`, `functions`
  - `pluginConfig` — plugin-specific config from `plugins[].config`
  - `siblingPlugins` — other loaded plugins for cross-plugin collaboration
- **ResolvedPaths** — Type for `ctx.paths`
- **SbtPluginCommand** — Command definition with `name`, `description`, `run`
- **ArtifactCapabilities** — Declare which artifact IDs a plugin `produces` and `consumes` (used by tooling to validate artifact availability)

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

## Filesystem Utilities

- `ensureDir(path)` — Create directory recursively
- `readText(path)` — Read file as UTF-8
- `writeFileInDir(dir, filename, content)` — Write file in directory
- `safeName(str)` — Replace non-word chars with underscore (for identifiers; preserves dots and hyphens)
- `safeFileName(baseName, maxLength?)` — Truncate long filenames with hash
- `sanitizeSlug(str)` — Hyphenated slug (e.g. plugin names, directory names)
- `sanitizeIdentifier(str)` — Alphanumeric + underscore (e.g. Mermaid node IDs)

## Container Utilities

For Docker Compose project naming (used by core and plugins that interact with containers):

- `sanitizeContainerPrefix(projectName)` — Sanitize raw project name into valid Docker prefix
- `deriveContainerPrefix(projectRoot)` — Read `supabase-tools.config.json` for `project.name`, fallback to basename, return sanitized prefix

```ts
import { deriveContainerPrefix, sanitizeContainerPrefix } from "@sbtools/sdk";

const prefix = deriveContainerPrefix(ctx.projectRoot);
const container = `${prefix}-supabase-db`;

// Or when you already have the name:
const prefix2 = sanitizeContainerPrefix(config.project.name);
```

## Compose Utilities

Extract values from Docker Compose YAML files:

- `extractComposeKey(composePath, patterns)` — First matching regex capture
- `extractSupabaseKeys(composePath)` — Returns `{ anonKey, serviceKey }` in one read (see `SupabaseKeys` type)

```ts
import { extractComposeKey, extractSupabaseKeys } from "@sbtools/sdk";

const { anonKey, serviceKey } = extractSupabaseKeys(path.join(ctx.toolsDir, "docker-compose.db.yml"));
const jwtSecret = extractComposeKey(composePath, [/JWT_SECRET:\s*([^\s]+)/]);
```

## CLI Utilities

- `hasFlag(args, ...names)` — Check for CLI flags (e.g. `--help`, `-h`)
- `getArg(args, name)` — Get CLI argument value (e.g. `--port 3000` → `"3000"`)
- `openFile(path)` — Open file in default editor
- `withHelp(helpText, fn)` — Wrap a command handler to provide `--help` / `-h` support
- `loadPackageVersion(importMetaUrl)` — Load version from nearest package.json (use `import.meta.url`)

### withHelp Example

```ts
import { withHelp } from "@sbtools/sdk";

const HELP = `
my-command — does something useful

Usage:
  sbt my-command [--flag] [--arg VALUE]

Options:
  --flag       Enable feature
  --arg VALUE  Set value
  -h, --help   Show this help
`;

const myCommand = withHelp(HELP, async (args: string[], ctx: PluginContext) => {
  // Command implementation
});
```

### loadPackageVersion Example

```ts
import { loadPackageVersion } from "@sbtools/sdk";

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-example",
  version: loadPackageVersion(import.meta.url), // Reads ../package.json
  commands: [/* ... */],
};
```

## Plugin Config Helpers

Typed accessors for plugin config values — replaces unsafe `(ctx.pluginConfig.foo as string) ?? default` casts:

- `getConfigString(ctx, key, fallback)` — Get a string config value
- `getConfigNumber(ctx, key, fallback)` — Get a number config value (parses strings too)
- `getConfigStringArray(ctx, key, fallback)` — Get a string array config value
- `resolveConfigPath(ctx, key, fallbackRelPath)` — Get a path config value; relative paths are resolved against `ctx.projectRoot`

```ts
import { getConfigString, getConfigNumber, getConfigStringArray, resolveConfigPath } from "@sbtools/sdk";

const output   = getConfigString(ctx, "outputDir", "docs/my-output");
const port     = getConfigNumber(ctx, "port", 3333);
const scanDirs = getConfigStringArray(ctx, "scanPaths", ["src/"]);
const typesOut = resolveConfigPath(ctx, "typesOutput", "src/types/supabase.ts");
```

## Artifact Helpers

Read and write typed artifact envelopes stored in `.sbt/artifacts/`:

- `writeArtifact(dir, id, version, payload)` — Write artifact JSON file
- `readArtifact(dir, id, version)` — Read artifact; throws if missing or version mismatch
- `readArtifactOrNull(dir, id, version)` — Read artifact; returns `null` if missing
- `createArtifactWriter(opts)` — Factory for writing multiple artifacts from the same plugin

```ts
import { writeArtifact, readArtifactOrNull } from "@sbtools/sdk";

// Write
await writeArtifact(ctx.artifactsDir, "my.artifact", "1.0.0", { items: [] });

// Read (returns null when missing instead of throwing)
const result = readArtifactOrNull(ctx.artifactsDir, "migration.analysis", "1.0.0");
if (result) { /* result.payload is the data */ }
```

## DB Utilities

Optional; plugins that need DB access must have `pg` installed. SDK exposes thin wrappers:

- `resolveDbUrl()` — From `DATABASE_URL`, `SUPABASE_DB_URL`, `POSTGRES_URL`, or default local URL
- `createPgClient()` — Create `pg.Client` (throws if `pg` not installed)
- `testConnection(client)` — Returns `true` if connect succeeds
- `disconnectClient(client)` — Safe disconnect

```ts
import { createPgClient, testConnection, disconnectClient } from "@sbtools/sdk";

const client = createPgClient();
try {
  if (await testConnection(client)) { /* ... */ }
} finally {
  await disconnectClient(client);
}
```

## Migration Scanner

- `scanMigrationFiles(dir)` — Returns `MigrationFileInfo[]` (.sql files, sorted)
- `parseTimestampPrefix(filename)` — Extract `YYYYMMDDHHMMSS` from migration filename

```ts
import { scanMigrationFiles, parseTimestampPrefix } from "@sbtools/sdk";

const files = scanMigrationFiles(ctx.paths.migrations);
const ts = parseTimestampPrefix("20240101120000_foo.sql"); // "20240101120000"
```

## SQL Analyzer

- `analyzeMigrationSql(sql)` — Regex-based DDL classifier. Returns `MigrationSqlAnalysis` with `operations`, `touchedObjectKeys`, `riskFlags`, `confidence`.

Used by migration-audit and migration-studio. No Node.js deps; can run in browser.

## Dashboard View

Use **`getDashboardView()`** to contribute sections to the `sbt dashboard` UI. Returns JSON-serializable config — no JS strings.

### Interfaces

- **`DashboardSectionDef`** — section config (id, title, description, dataKey, layout, stats, card, table, link)
- **`DashboardCardDef`** — card layout (titleField, subtitleField, searchFields, badges, details)
- **`DashboardTableDef`** — table layout (columns with header, field, format)
- **`DashboardStatDef`** — stat row (label, field, tone)
- **`DashboardBadgeDef`** — badge (field, toneMap)
- **`DashboardDetailDef`** — detail row (label, field, format)
- **`DashboardView`** — `{ sections: DashboardSectionDef[] }`

### Example

```ts
import type { DashboardSectionDef, DashboardView } from "@sbtools/sdk";

export function getMyPluginDashboardView(): DashboardView {
  return {
    sections: [
      {
        id: "my-items",
        title: "My Items",
        description: "Items from the database.",
        dataKey: "my_items",
        layout: "cards",
        stats: [
          { label: "Total", field: "summary.total", tone: "good" },
        ],
        card: {
          titleField: "name",
          subtitleField: "type",
          searchFields: ["name", "description"],
          badges: [{ field: "status", toneMap: { active: "good", inactive: "warn" } }],
          details: [
            { label: "Description", field: "description" },
            { label: "Created", field: "created_at", format: "date" },
          ],
        },
      },
    ],
  };
}
```

Formats: `text`, `code`, `date`, `bytes`, `ms`, `number`. Tones: `default`, `good`, `warn`, `bad`, `accent`.

## Schema Filters (Parameterized Queries)

**`SchemaFilter`** — `{ clause: string; params: string[] }` — used by snapshot extractors to inject schema filters into SQL queries using parameterized placeholders (`$1`, `$2`, ...) instead of string interpolation.

```ts
import type { SchemaFilter } from "@sbtools/sdk";

const filter: SchemaFilter = {
  clause: "AND n.nspname IN ($1, $2)",
  params: ["public", "extensions"],
};

const result = await client.query(
  `SELECT * FROM pg_namespace n WHERE true ${filter.clause}`,
  filter.params
);
```

**Core utility:** `getSchemaFilter(schemas, column)` in `@sbtools/core` generates these filters from user config.

## Building Plugins

See [plugin-scaffold](/plugins/plugin-scaffold) to scaffold a new plugin, or inspect existing plugins in the repository.
