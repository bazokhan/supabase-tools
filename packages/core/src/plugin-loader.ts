/**
 * Dynamically loads plugins declared in supabase-tools.config.json
 *
 * Plugins are discovered at runtime via `import()` — there are zero
 * compile-time imports between the main package and any plugin folder.
 *
 * Supports two modes:
 * - npm package name (e.g. "@sbtools/plugin-erd") -> Node native resolution
 * - filesystem path (e.g. "./my-plugin") -> try dist/index.js, index.js, index.ts, src/index.ts
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config, resolve } from "./config.js";
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";
import { ui } from "@sbtools/sdk";

export type { SbtPlugin, PluginContext };

/** A loaded plugin paired with its config block from the JSON. */
export interface LoadedPlugin {
  plugin: SbtPlugin;
  pluginConfig: Record<string, unknown>;
}

function isPackageName(p: string): boolean {
  return (
    p.startsWith("@") ||
    (!p.startsWith(".") && !path.isAbsolute(p) && !p.includes("/") && !p.includes("\\"))
  );
}

const FILESYSTEM_CANDIDATES = ["dist/index.js", "index.js", "index.ts", "src/index.ts"];

async function resolveAndImport(entryPath: string): Promise<{ plugin: SbtPlugin } | null> {
  if (isPackageName(entryPath)) {
    try {
      const mod = await import(entryPath);
      const plugin: SbtPlugin = mod.default ?? mod.plugin;
      return plugin && plugin.name ? { plugin } : null;
    } catch {
      return null;
    }
  }

  const pluginDir = resolve(entryPath);
  for (const candidate of FILESYSTEM_CANDIDATES) {
    const filePath = path.join(pluginDir, candidate);
    if (fs.existsSync(filePath)) {
      try {
        const fileUrl = pathToFileURL(filePath).href;
        const mod = await import(fileUrl);
        const plugin: SbtPlugin = mod.default ?? mod.plugin;
        return plugin && plugin.name ? { plugin } : null;
      } catch {
        continue;
      }
    }
  }
  return null;
}

/** Packages that were merged into core — gracefully skip with a helpful warning. */
const MERGED_INTO_CORE = [
  "@sbtools/plugin-atlas-html",
  "@sbtools/plugin-docs-server",
];

/**
 * Load config-declared plugins.
 */
export async function loadPlugins(): Promise<LoadedPlugin[]> {
  const loaded: LoadedPlugin[] = [];

  const entries = config.plugins ?? [];
  for (const entry of entries) {
    if (entry.enabled === false) continue;

    // Detect known merged packages
    if (MERGED_INTO_CORE.includes(entry.path)) {
      ui.warn(`⚠️  ${entry.path} has been merged into @sbtools/core. Remove it from your plugins config.`);
      continue;
    }

    try {
      const result = await resolveAndImport(entry.path);
      if (!result) {
        ui.warn(`⚠️  Plugin at ${entry.path} does not export a valid SbtPlugin. Skipping.`);
        continue;
      }

      loaded.push({
        plugin: result.plugin,
        pluginConfig: entry.config ?? {},
      });
    } catch (err) {
      ui.warn(`⚠️  Failed to load plugin at ${entry.path}: ${(err as Error).message}`);
    }
  }

  return loaded;
}

/** Build the PluginContext passed to every plugin hook. */
export function buildPluginContext(
  loaded: LoadedPlugin,
  allLoaded?: LoadedPlugin[],
): PluginContext {
  const artifactsDir = path.join(config.sbtDataDir, "artifacts");
  return {
    projectRoot: config.projectRoot,
    toolsDir: config.toolsDir,
    sbtDataDir: config.sbtDataDir,
    artifactsDir,
    pluginConfig: loaded.pluginConfig,
    apiUrl: config.api.url,
    paths: {
      migrations: resolve(config.paths.migrations),
      snapshot: resolve(config.paths.snapshot),
      docsOutput: resolve(config.paths.docsOutput),
      functions: resolve(config.paths.functions),
    },
    siblingPlugins: allLoaded
      ?.filter((l) => l.plugin.name !== loaded.plugin.name)
      .map((l) => l.plugin),
  };
}

/** Build a PluginContext for core commands that need plugin access (e.g. docs merging OpenAPI). */
export function buildCoreContext(allLoaded: LoadedPlugin[]): PluginContext {
  const artifactsDir = path.join(config.sbtDataDir, "artifacts");
  return {
    projectRoot: config.projectRoot,
    toolsDir: config.toolsDir,
    sbtDataDir: config.sbtDataDir,
    artifactsDir,
    pluginConfig: {},
    apiUrl: config.api.url,
    paths: {
      migrations: resolve(config.paths.migrations),
      snapshot: resolve(config.paths.snapshot),
      docsOutput: resolve(config.paths.docsOutput),
      functions: resolve(config.paths.functions),
    },
    siblingPlugins: allLoaded.map((l) => l.plugin),
  };
}
