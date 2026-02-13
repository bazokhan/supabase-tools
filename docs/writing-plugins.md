---
description: Build custom supabase-tools plugins — from scaffold to publish.
---

# Writing Plugins

A plugin is a default-exported object that satisfies `SbtPlugin`. It can add CLI commands and hook into core operations like `status`, `generate-atlas`, and `docs`.

## Scaffold

```bash
npx sbt scaffold-plugin my-plugin          # packages/plugin-my-plugin/
npx sbt scaffold-plugin my-plugin --external  # plugin-my-plugin/ at project root
npx sbt scaffold-plugin my-plugin --hooks     # include Atlas/status/OpenAPI stubs
```

## Minimal Plugin

```ts
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";
import { ui } from "@sbtools/sdk";

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-my-plugin",
  version: "1.0.0",

  commands: [
    {
      name: "my-command",
      description: "Does something useful",
      async run(args: string[], ctx: PluginContext) {
        ui.step("Working...");
        // ctx.projectRoot, ctx.paths, ctx.pluginConfig are available
        ui.success("Done");
      },
    },
  ],
};

export default plugin;
```

Register it in `supabase-tools.config.json`:

```json
{
  "plugins": [
    { "path": "./packages/plugin-my-plugin", "config": {} }
  ]
}
```

Run it: `npx sbt my-command`

## PluginContext

Every command and hook receives `ctx`:

| Property | Type | Description |
|----------|------|-------------|
| `projectRoot` | `string` | Absolute path to the project root |
| `toolsDir` | `string` | Absolute path to the core package (Docker files) |
| `sbtDataDir` | `string` | Project-local runtime data (`.sbt/`) |
| `apiUrl` | `string` | Supabase API URL |
| `paths` | `ResolvedPaths` | `migrations`, `snapshot`, `docsOutput`, `functions` — all absolute |
| `pluginConfig` | `Record<string, unknown>` | Plugin-specific config from the `config` block |
| `siblingPlugins` | `SbtPlugin[]` | Other loaded plugins for cross-plugin collaboration |

## Reading Config

Plugin config is untyped — cast and default at runtime:

```ts
const output = (ctx.pluginConfig.outputDir as string) ?? "docs/my-output";
const limit = (ctx.pluginConfig.limit as number) ?? 10;
```

## CLI Flags

```ts
import { hasFlag, getArg } from "@sbtools/sdk";

async run(args: string[], ctx: PluginContext) {
  if (hasFlag(args, "--json"))  { /* output JSON */ }
  if (hasFlag(args, "-h", "--help")) { /* show help */ }
  const port = getArg(args, "--port") ?? "3000";
}
```

## Hooks

Hooks let your plugin contribute to core commands. All are optional.

| Hook | Called by | Returns |
|------|-----------|---------|
| `getAtlasData(ctx)` | `sbt generate-atlas` | `{ categories: Record<string, any[]>, stats: { label, value }[] }` |
| `getAtlasUI()` | `sbt atlas-html` | `{ kindLabels, sectionHtml, cardRendererJs, initJs, styles }` |
| `getStatusLines(ctx)` | `sbt status` | `string[]` — lines appended to status output |
| `getOpenApiSpec(ctx)` | `sbt docs` | Partial OpenAPI 3.0 object (deep-merged into the PostgREST spec) |

Example:

```ts
const plugin: SbtPlugin = {
  name: "@sbtools/plugin-example",
  version: "1.0.0",
  commands: [/* ... */],

  async getStatusLines(ctx) {
    return ["  My Plugin: 3 items tracked"];
  },

  async getAtlasData(ctx) {
    return {
      categories: { my_items: [{ name: "Item 1" }, { name: "Item 2" }] },
      stats: [{ label: "My Items", value: 2 }],
    };
  },
};
```

## SDK Utilities

See the full list in [SDK API](/sdk/). Most commonly used:

```ts
import { ui, ensureDir, writeFileInDir, readText, openFile } from "@sbtools/sdk";

ensureDir(outputDir);
writeFileInDir(outputDir, "report.html", html);
const content = readText(filePath);
openFile(outputPath); // open in default app
```

## Publishing

1. Build: `npm run build` (or `tsc` in your plugin directory)
2. Publish: `npm publish --access public`
3. Users install via `npm install @your-scope/plugin-name` and add it to their config
