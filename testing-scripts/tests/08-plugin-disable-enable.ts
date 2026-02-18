/**
 * Test: sbt plugin disable / sbt plugin enable
 *
 * Expected:
 *  - disable: sets enabled=false, shows [disabled] in list
 *  - enable: sets enabled=true, shows [configured ✓] in list
 *  - disabling again → "already disabled"
 *  - enabling again → "already enabled"
 */
import fs from "node:fs";
import path from "node:path";
import { runCli, assertContains, assertExitCode, log } from "../utils.js";

export const name = "sbt plugin disable/enable — toggles correctly, detects no-ops";

export function run(targetDir: string): void {
  runCli(["init"], targetDir);
  runCli(["plugin", "add", "@sbtools/plugin-erd"], targetDir);

  const configPath = path.join(targetDir, "supabase-tools.config.json");

  // --- disable ---
  log.info("disabling @sbtools/plugin-erd");
  const disableResult = runCli(["plugin", "disable", "@sbtools/plugin-erd"], targetDir);

  log.output(disableResult.combined);

  assertExitCode(disableResult, 0);
  assertContains(disableResult.combined, "Disabled plugin");

  const cfg1 = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const entry1 = cfg1.plugins.find((p: { path: string }) => p.path === "@sbtools/plugin-erd");
  if (entry1.enabled !== false) throw new Error("expected enabled=false after disable");

  // list should show [disabled]
  const listResult1 = runCli(["plugin", "list"], targetDir);
  assertContains(listResult1.combined, "[disabled]");

  // --- disable again (no-op) ---
  log.info("disabling again (should report already disabled)");
  const disable2 = runCli(["plugin", "disable", "@sbtools/plugin-erd"], targetDir);
  assertContains(disable2.combined, "already disabled");

  // --- enable ---
  log.info("enabling @sbtools/plugin-erd");
  const enableResult = runCli(["plugin", "enable", "@sbtools/plugin-erd"], targetDir);

  log.output(enableResult.combined);

  assertExitCode(enableResult, 0);
  assertContains(enableResult.combined, "Enabled plugin");

  const cfg2 = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const entry2 = cfg2.plugins.find((p: { path: string }) => p.path === "@sbtools/plugin-erd");
  if (entry2.enabled !== true) throw new Error("expected enabled=true after enable");

  // list should show [configured ✓]
  const listResult2 = runCli(["plugin", "list"], targetDir);
  assertContains(listResult2.combined, "[configured ✓]");

  // --- enable again (no-op) ---
  log.info("enabling again (should report already enabled)");
  const enable2 = runCli(["plugin", "enable", "@sbtools/plugin-erd"], targetDir);
  assertContains(enable2.combined, "already enabled");
}
