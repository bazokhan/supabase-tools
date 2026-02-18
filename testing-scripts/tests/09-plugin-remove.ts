/**
 * Test: sbt plugin remove <name>
 *
 * Expected:
 *  - Removes plugin from config
 *  - Plugin shows as [not configured] after removal
 *  - Removing non-existent plugin reports warning, does not crash
 */
import fs from "node:fs";
import path from "node:path";
import { runCli, assertContains, assertExitCode, log } from "../utils.js";

export const name = "sbt plugin remove — removes from config, handles missing gracefully";

export function run(targetDir: string): void {
  runCli(["init"], targetDir);
  runCli(["plugin", "add", "@sbtools/plugin-erd"], targetDir);

  const configPath = path.join(targetDir, "supabase-tools.config.json");

  // Verify plugin is in config before remove
  const cfg1 = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!cfg1.plugins.some((p: { path: string }) => p.path === "@sbtools/plugin-erd")) {
    throw new Error("plugin not in config before remove test");
  }

  // --- remove ---
  log.info("removing @sbtools/plugin-erd");
  const removeResult = runCli(["plugin", "remove", "@sbtools/plugin-erd"], targetDir);

  log.output(removeResult.combined);

  assertExitCode(removeResult, 0);
  assertContains(removeResult.combined, "Removed plugin");

  // Verify gone from config
  const cfg2 = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (cfg2.plugins.some((p: { path: string }) => p.path === "@sbtools/plugin-erd")) {
    throw new Error("plugin still in config after remove");
  }

  // list should show [not configured]
  const listResult = runCli(["plugin", "list"], targetDir);
  assertContains(listResult.combined, "[not configured]");

  // --- remove non-existent ---
  log.info("removing plugin that is not in config (should warn)");
  const remove2 = runCli(["plugin", "remove", "@sbtools/plugin-erd"], targetDir);

  log.output(remove2.combined);

  assertExitCode(remove2, 0);
  assertContains(remove2.combined, "not found in config");
}
