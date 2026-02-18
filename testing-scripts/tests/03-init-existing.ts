/**
 * Test: sbt init when config already exists.
 *
 * Expected:
 *  - Does NOT overwrite config
 *  - Prints "already exists" message + plugin tip
 *  - Still ensures directories exist
 */
import path from "node:path";
import { runCli, assertContains, assertNotContains, assertExitCode, assertDirExists, log } from "../utils.js";

export const name = "sbt init — config already exists (no overwrite, tip shown)";

export function run(targetDir: string): void {
  // First init to create the config
  runCli(["init"], targetDir);

  // Second init — should detect existing config
  const result = runCli(["init"], targetDir);

  log.output(result.combined);

  assertExitCode(result, 0);
  assertContains(result.combined, "already exists");
  assertContains(result.combined, "sbt plugin list");
  // Should NOT print "Next steps" again (that's for fresh init only)
  assertNotContains(result.combined, "Next steps");

  // Dirs should still be present
  assertDirExists(path.join(targetDir, "supabase", "migrations"));
  assertDirExists(path.join(targetDir, "supabase", "current"));
}
