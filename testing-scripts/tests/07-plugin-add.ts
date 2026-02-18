/**
 * Test: sbt plugin add <name>
 *
 * Expected:
 *  - Adds plugin to config JSON
 *  - Reports success
 *  - Prints npm install hint
 *  - Plugin shows as [configured ✓] in subsequent list
 *  - Adding again reports "already in config" warning
 */
import fs from "node:fs";
import path from "node:path";
import { runCli, assertContains, assertNotContains, assertExitCode, log } from "../utils.js";

export const name = "sbt plugin add — adds to config, shows configured, detects duplicate";

export function run(targetDir: string): void {
  runCli(["init"], targetDir);

  // --- add ---
  log.info("adding @sbtools/plugin-erd");
  const addResult = runCli(["plugin", "add", "@sbtools/plugin-erd"], targetDir);

  log.output(addResult.combined);

  assertExitCode(addResult, 0);
  assertContains(addResult.combined, "Added plugin");
  assertContains(addResult.combined, "@sbtools/plugin-erd");
  assertContains(addResult.combined, "npm install");

  // --- verify config on disk ---
  const configPath = path.join(targetDir, "supabase-tools.config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const pluginEntry = config.plugins.find((p: { path: string }) => p.path === "@sbtools/plugin-erd");
  if (!pluginEntry) throw new Error("plugin not found in config after add");
  if (pluginEntry.enabled !== true) throw new Error("plugin.enabled should be true after add");

  // --- list shows configured ---
  log.info("checking list after add");
  const listResult = runCli(["plugin", "list"], targetDir);
  assertContains(listResult.combined, "[configured ✓]");

  // --- duplicate detection ---
  log.info("adding same plugin again (should warn)");
  const dupResult = runCli(["plugin", "add", "@sbtools/plugin-erd"], targetDir);

  log.output(dupResult.combined);

  assertExitCode(dupResult, 0);
  assertContains(dupResult.combined, "already in config");
  assertNotContains(dupResult.combined, "Added plugin");

  // Config should still have only one entry for this plugin
  const config2 = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const entries = config2.plugins.filter((p: { path: string }) => p.path === "@sbtools/plugin-erd");
  if (entries.length !== 1) throw new Error(`expected 1 plugin entry, got ${entries.length}`);
}
