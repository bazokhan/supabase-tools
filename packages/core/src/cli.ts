#!/usr/bin/env node
import { ui, handleError } from "@sbtools/sdk";
import { loadPlugins, buildPluginContext, buildCoreContext } from "./plugin-loader.js";
import { preflight } from "./preflight.js";
import { getCommand } from "./command-registry.js";
import { showHelp } from "./commands/help.js";
import "./commands/register-core.js";

const command = process.argv[2];
const args = process.argv.slice(3);

try {
  const loaded = await loadPlugins();
  const pluginCommands = loaded.flatMap((entry) =>
    (entry.plugin.commands ?? []).map((cmd) => ({ plugin: entry.plugin.name, cmd, loaded: entry }))
  );

  if (command) preflight(command, args);

  if (command === "help" || command === "--help" || command === "-h" || command === undefined) {
    showHelp(pluginCommands);
  } else {
    const coreEntry = getCommand(command);
    if (coreEntry) {
      const coreCtx = buildCoreContext(loaded);
      await coreEntry.run(args, coreCtx);
    } else {
      const match = pluginCommands.find((pc) => pc.cmd.name === command);
      if (match) {
        const ctx = buildPluginContext(match.loaded, loaded);
        await match.cmd.run(args, ctx);
      } else {
        ui.error(`Unknown command: ${command}\n`);
        showHelp(pluginCommands);
        process.exit(1);
      }
    }
  }
} catch (error) {
  handleError(error);
}
