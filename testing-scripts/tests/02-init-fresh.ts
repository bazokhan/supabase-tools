/**
 * Test: sbt init in a clean directory.
 *
 * Expected:
 *  - Creates supabase-tools.config.json
 *  - Creates all required directories (migrations, current, functions, docs, .sbt)
 *  - Prints "Next steps" guide
 *  - Adds .sbt/ to .gitignore
 */
import path from "node:path";
import { runCli, assertContains, assertExitCode, assertDirExists, assertFileExists, log } from "../utils.js";

export const name = "sbt init — fresh directory (creates config + all dirs + next steps)";

export function run(targetDir: string): void {
  const result = runCli(["init"], targetDir);

  log.output(result.combined);

  assertExitCode(result, 0);
  assertContains(result.combined, "Created");
  assertContains(result.combined, "supabase-tools.config.json");
  assertContains(result.combined, "Next steps");
  assertContains(result.combined, "sbt start");
  assertContains(result.combined, "sbt snapshot");
  assertContains(result.combined, "sbt generate-atlas");
  assertContains(result.combined, "sbt dashboard");
  assertContains(result.combined, "sbt plugin list");

  // All required directories must exist
  assertDirExists(path.join(targetDir, "supabase", "migrations"));
  assertDirExists(path.join(targetDir, "supabase", "current"));
  assertDirExists(path.join(targetDir, "supabase", "functions"));
  assertDirExists(path.join(targetDir, "docs"));
  assertDirExists(path.join(targetDir, ".sbt"));
  assertDirExists(path.join(targetDir, ".sbt", "artifacts"));

  // Config and gitignore created
  assertFileExists(path.join(targetDir, "supabase-tools.config.json"));
  assertFileExists(path.join(targetDir, ".gitignore"));
  assertFileExists(path.join(targetDir, ".sbt", ".env"));
  assertFileExists(path.join(targetDir, "supabase", "functions", ".env"));
}
