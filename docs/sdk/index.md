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

## Atlas UI Builder

**`buildAtlasUI(sections, styles?)`** — declarative builder for Backend Atlas UI contributions. Generates section HTML, card renderer JavaScript, init JS, and styles from a single configuration object. Replaces the old manual "triad pattern" (separate `sections.ts`, `cards.ts`, `styles.ts` files).

### Interfaces

- **`AtlasSectionDef`** — section configuration (id, title, description, data key, card/summary definitions)
- **`AtlasCardDef`** — card rendering config (title, subtitle, badges, details) — all fields are JS expressions evaluated in the renderer
- **`AtlasBadgeDef`** — badge config (label, cssClass, condition)
- **`AtlasDetailDef`** — detail row config (heading, value, pre?)
- **`AtlasSummaryDef`** — optional summary block config (customJs or heading/items)

### Example

```ts
import { buildAtlasUI, type AtlasSectionDef } from "@sbtools/sdk";

const sections: AtlasSectionDef[] = [
  {
    id: "my-items",
    title: "My Items",
    description: "Items extracted from the database.",
    kind: "my_item",
    kindLabel: "My Item",
    listId: "my-items-list",
    dataKey: "my_items",
    rendererName: "renderMyItemCard",
    emptyLabel: "items",
    card: {
      searchFields: ["item.name", "item.description"],
      title: "item.name",
      subtitle: "item.type + ' — ' + item.count + ' rows'",
      badges: [
        { label: "'active'", cssClass: "badge-green", condition: "item.active" },
      ],
      details: [
        { heading: "Description", value: "item.description" },
        { heading: "Created", value: "item.created_at" },
      ],
    },
  },
];

export function getMyPluginAtlasUI() {
  return buildAtlasUI(sections, myCustomStyles());
}
```

### Advanced: Custom JS Overrides

For complex card rendering (tables, nested loops), use `customCardRendererJs`:

```ts
{
  id: "complex-section",
  // ... other fields ...
  card: {
    searchFields: ["item.name"],
    customCardRendererJs: `
      const rows = item.rows.map(r => \`<tr><td>\${esc(r.col1)}</td></tr>\`).join('');
      return \`<details class="card"><summary>...</summary><table>\${rows}</table></details>\`;
    `,
  },
}
```

**Note:** `buildAtlasUI` automatically injects `var esc = escapeHtml;` into all card renderers, making the `esc()` function available without implicit globals.

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
