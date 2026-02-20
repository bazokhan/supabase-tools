/**
 * Plugin management command: list, add, remove, enable, disable plugins.
 */
import fs from "node:fs";
import path from "node:path";
import { ui, SbtError } from "@sbtools/sdk";
import { config } from "../config.js";
import { BUILTIN_PLUGINS } from "../lib/plugin-catalog.js";

interface PluginEntry {
  path: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

interface ConfigFile {
  plugins?: PluginEntry[];
  [key: string]: unknown;
}

/** Read config from disk directly (not the loaded singleton). */
function readConfigFile(): ConfigFile {
  const configPath = path.join(config.projectRoot, "supabase-tools.config.json");
  if (!fs.existsSync(configPath)) {
    throw new SbtError(
      "CONFIG_VALIDATION",
      `supabase-tools.config.json not found at ${configPath}. Run 'sbt init' first.`,
    );
  }
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw) as ConfigFile;
  } catch (err) {
    throw new SbtError("CONFIG_PARSE", `Failed to parse config: ${(err as Error).message}`);
  }
}

/** Write config back to disk. */
function writeConfigFile(cfg: ConfigFile): void {
  const configPath = path.join(config.projectRoot, "supabase-tools.config.json");
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

/** List all plugins (built-in and configured). */
function listPlugins(): void {
  const cfg = readConfigFile();
  const plugins: PluginEntry[] = cfg.plugins ?? [];
  const configuredPaths = new Set(plugins.map((p) => p.path));
  const configuredMap = new Map<string, { enabled: boolean }>(
    plugins.map((p): [string, { enabled: boolean }] => [p.path, { enabled: p.enabled !== false }]),
  );

  ui.heading("Available @sbtools plugins:");
  for (const { name, desc } of BUILTIN_PLUGINS) {
    const isConfigured = configuredPaths.has(name);
    const entry = configuredMap.get(name);
    const status = !isConfigured ? "[not configured]" : entry?.enabled ? "[configured ✓]" : "[disabled]";
    ui.detail(`  ${name.padEnd(34)}${desc.padEnd(42)}${status}`);
  }

  // Show any custom configured plugins not in the built-in list
  const customPlugins = plugins.filter(
    (p) => !BUILTIN_PLUGINS.some((bp) => bp.name === p.path),
  );
  if (customPlugins.length > 0) {
    ui.blank();
    ui.heading("Configured custom plugins:");
    for (const p of customPlugins) {
      const status = p.enabled !== false ? "[enabled]" : "[disabled]";
      ui.detail(`  ${p.path.padEnd(32)}${status}`);
    }
  }

  ui.blank();
  ui.detail("To add a plugin:    sbt plugin add @sbtools/plugin-erd");
  ui.detail("Then install it:    npm install @sbtools/plugin-erd");
}

/** Add a plugin to the config. */
function addPlugin(name: string | undefined): void {
  if (!name) {
    throw new SbtError("COMMAND_FAILED", "Plugin name required. Usage: sbt plugin add <name>");
  }

  const cfg = readConfigFile();
  const plugins: PluginEntry[] = cfg.plugins ?? [];

  // Check if already exists
  if (plugins.some((p) => p.path === name)) {
    ui.warn(`Plugin '${name}' already in config.`);
    return;
  }

  // Add the plugin
  plugins.push({ path: name, enabled: true, config: {} });
  cfg.plugins = plugins;
  writeConfigFile(cfg);

  ui.success(`Added plugin: ${name}`);
  // Suggest npm install for npm packages
  if (name.startsWith("@") || (!name.includes("/") && !name.includes("."))) {
    ui.detail(`  Install it with: npm install ${name}`);
  }
}

/** Remove a plugin from the config. */
function removePlugin(name: string | undefined): void {
  if (!name) {
    throw new SbtError("COMMAND_FAILED", "Plugin name required. Usage: sbt plugin remove <name>");
  }

  const cfg = readConfigFile();
  const plugins: PluginEntry[] = cfg.plugins ?? [];
  const filtered = plugins.filter((p) => p.path !== name);

  if (filtered.length === plugins.length) {
    ui.warn(`Plugin '${name}' not found in config.`);
    return;
  }

  cfg.plugins = filtered;
  writeConfigFile(cfg);
  ui.success(`Removed plugin: ${name}`);
}

/** Enable a plugin. */
function enablePlugin(name: string | undefined): void {
  if (!name) {
    throw new SbtError("COMMAND_FAILED", "Plugin name required. Usage: sbt plugin enable <name>");
  }

  const cfg = readConfigFile();
  const plugins: PluginEntry[] = cfg.plugins ?? [];
  const plugin = plugins.find((p) => p.path === name);

  if (!plugin) {
    throw new SbtError(
      "COMMAND_FAILED",
      `Plugin '${name}' not found in config. Add it first: sbt plugin add ${name}`,
    );
  }

  if (plugin.enabled !== false) {
    ui.info(`Plugin '${name}' is already enabled.`);
    return;
  }

  plugin.enabled = true;
  cfg.plugins = plugins;
  writeConfigFile(cfg);
  ui.success(`Enabled plugin: ${name}`);
}

/** Disable a plugin. */
function disablePlugin(name: string | undefined): void {
  if (!name) {
    throw new SbtError("COMMAND_FAILED", "Plugin name required. Usage: sbt plugin disable <name>");
  }

  const cfg = readConfigFile();
  const plugins: PluginEntry[] = cfg.plugins ?? [];
  const plugin = plugins.find((p) => p.path === name);

  if (!plugin) {
    throw new SbtError(
      "COMMAND_FAILED",
      `Plugin '${name}' not found in config. Add it first: sbt plugin add ${name}`,
    );
  }

  if (plugin.enabled === false) {
    ui.info(`Plugin '${name}' is already disabled.`);
    return;
  }

  plugin.enabled = false;
  cfg.plugins = plugins;
  writeConfigFile(cfg);
  ui.success(`Disabled plugin: ${name}`);
}

function printPluginHelp(): void {
  ui.blank();
  ui.detail("Usage:");
  ui.detail("  sbt plugin list                   — List available plugins");
  ui.detail("  sbt plugin add <name>             — Add a plugin");
  ui.detail("  sbt plugin remove <name>          — Remove a plugin");
  ui.detail("  sbt plugin enable <name>          — Enable a plugin");
  ui.detail("  sbt plugin disable <name>         — Disable a plugin");
}

/** Main plugin command dispatcher. */
export async function runPlugin(args: string[]): Promise<void> {
  const subcommand = args[0];
  const arg: string | undefined = args[1];

  switch (subcommand) {
    case "list":
      listPlugins();
      break;
    case "add":
      addPlugin(arg);
      break;
    case "remove":
      removePlugin(arg);
      break;
    case "enable":
      enablePlugin(arg);
      break;
    case "disable":
      disablePlugin(arg);
      break;
    default:
      if (subcommand) {
        ui.error(`Unknown plugin subcommand: ${subcommand}`);
      }
      printPluginHelp();
      if (subcommand) process.exit(1);
  }
}
