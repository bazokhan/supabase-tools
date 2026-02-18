/**
 * Test: sbt help with no config file present.
 *
 * Expected: warning banner + Quick Start section shown, no crash.
 */
import { runCli, assertContains, assertExitCode, log } from "../utils.js";

export const name = "sbt help — no config (warning banner + Quick Start)";

export function run(targetDir: string): void {
  const result = runCli(["help"], targetDir);

  log.output(result.combined);

  assertExitCode(result, 0);
  assertContains(result.combined, "No supabase-tools.config.json found");
  assertContains(result.combined, "sbt init");
  assertContains(result.combined, "Quick Start");
  assertContains(result.combined, "sbt init → sbt start → sbt snapshot → sbt generate-atlas → sbt dashboard");
  assertContains(result.combined, "plugin");
}
