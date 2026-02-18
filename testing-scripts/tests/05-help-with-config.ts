/**
 * Test: sbt help when config file exists.
 *
 * Expected:
 *  - NO "No supabase-tools.config.json found" warning
 *  - Quick Start section still shown
 *  - All command categories listed
 *  - plugin command visible in Setup category
 */
import { runCli, assertContains, assertNotContains, assertExitCode, log } from "../utils.js";

export const name = "sbt help — config present (no warning, Quick Start shown, plugin listed)";

export function run(targetDir: string): void {
  // Set up: create config first
  runCli(["init"], targetDir);

  const result = runCli(["help"], targetDir);

  log.output(result.combined);

  assertExitCode(result, 0);

  // Warning should NOT appear when config exists
  assertNotContains(result.combined, "No supabase-tools.config.json found");

  // Quick Start always shown
  assertContains(result.combined, "Quick Start");

  // All core categories present
  assertContains(result.combined, "Docker:");
  assertContains(result.combined, "Database:");
  assertContains(result.combined, "Setup:");

  // plugin command registered
  assertContains(result.combined, "plugin");
  assertContains(result.combined, "Manage plugins");
}
