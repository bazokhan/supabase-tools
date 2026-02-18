/**
 * Test: sbt migrate after sbt init.
 *
 * Expected:
 *  - Preflight check PASSES (migrations dir exists, created by init)
 *  - Reports "No migration files found." instead of a preflight error
 *
 * This is the critical regression test for the bug where ensureDirs() did not
 * create supabase/migrations, causing sbt migrate to fail immediately after
 * sbt init with a confusing "run sbt init" message.
 */
import { runCli, assertContains, assertNotContains, log } from "../utils.js";

export const name = "sbt migrate — after init, preflight passes (no PREFLIGHT_FAILED error)";

export function run(targetDir: string): void {
  // Set up: run init first
  runCli(["init"], targetDir);

  // Now run migrate — should pass preflight
  const result = runCli(["migrate"], targetDir);

  log.output(result.combined);

  // Must NOT contain the preflight failure message
  assertNotContains(result.combined, "PREFLIGHT_FAILED");
  assertNotContains(result.combined, "Pre-flight check failed");
  assertNotContains(result.combined, "run `sbt init`");

  // Must report no files (correct outcome when migrations dir is empty)
  assertContains(result.combined, "No migration files found");
}
