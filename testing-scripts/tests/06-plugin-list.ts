/**
 * Test: sbt plugin list
 *
 * Expected:
 *  - Lists all 9 known @sbtools/ plugins
 *  - All show [not configured] in fresh state
 *  - Shows add/install hints
 */
import { runCli, assertContains, assertExitCode, log } from "../utils.js";

export const name = "sbt plugin list — all 9 built-in plugins shown as [not configured]";

const EXPECTED_PLUGINS = [
  "@sbtools/plugin-erd",
  "@sbtools/plugin-migration-audit",
  "@sbtools/plugin-depgraph",
  "@sbtools/plugin-typegen",
  "@sbtools/plugin-db-test",
  "@sbtools/plugin-logs",
  "@sbtools/plugin-deno-functions",
  "@sbtools/plugin-frontend-usage",
  "@sbtools/plugin-scaffold",
];

export function run(targetDir: string): void {
  // Set up: need config to exist
  runCli(["init"], targetDir);

  const result = runCli(["plugin", "list"], targetDir);

  log.output(result.combined);

  assertExitCode(result, 0);

  for (const plugin of EXPECTED_PLUGINS) {
    assertContains(result.combined, plugin);
    assertContains(result.combined, "[not configured]");
  }

  assertContains(result.combined, "sbt plugin add");
  assertContains(result.combined, "npm install");
}
