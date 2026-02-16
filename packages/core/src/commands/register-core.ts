/**
 * Registers all core commands with the registry.
 * Import this before using getCommand/allCommands.
 */
import { registerCommand } from "../command-registry.js";
import { runSnapshot } from "./snapshot.js";
import { runGenerateData } from "./generate-data.js";
import { runMigrate } from "./migrate.js";
import { runStatus } from "./status.js";
import { runWatch } from "./watch.js";
import { init } from "./init.js";
import { runStart, runStop, runRestart } from "./docker.js";
import type { PluginContext } from "@sbtools/sdk";
import { docsCommand } from "./docs.js";
import { atlasHtmlCommand } from "./atlas-html.js";

registerCommand({ name: "start", description: "Start all Supabase Docker services", category: "Docker", run: async () => { runStart(); await runStatus(); } });
registerCommand({ name: "stop", description: "Stop all services", category: "Docker", run: async () => { runStop(); } });
registerCommand({ name: "restart", description: "Restart all services", category: "Docker", run: async () => { runRestart(); } });
registerCommand({ name: "status", description: "Show service URLs, keys, and connection info", category: "Docker", run: runStatus });
registerCommand({ name: "migrate", description: "Apply SQL migrations to running DB", category: "Database", run: runMigrate });
registerCommand({ name: "snapshot", description: "Export DB objects (functions, views, etc.) to filesystem", category: "Database", run: runSnapshot });
registerCommand({ name: "watch", description: "Watch DB/files and keep artifacts refreshed", category: "Database", run: (args, ctx) => runWatch(args, ctx as PluginContext) });
registerCommand({ name: "generate-atlas", description: "Generate Backend Atlas data (JSON)", category: "Code Generation", run: runGenerateData });
registerCommand({
  name: "atlas-html",
  description: "Generate Backend Atlas HTML visualization",
  category: "Code Generation",
  run: (args, ctx) => atlasHtmlCommand(args, ctx as PluginContext),
});
registerCommand({
  name: "docs",
  description: "Start documentation services (swagger, redoc, atlas, schemaspy)",
  category: "Docs",
  run: (args, ctx) => docsCommand(args, ctx as PluginContext),
});
registerCommand({ name: "init", description: "Generate supabase-tools.config.json with defaults", category: "Setup", run: async () => { init(); } });
