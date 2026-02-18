/**
 * Test: sbt plugin commands without a config file.
 *
 * Expected:
 *  - plugin list/add/remove exit with non-zero and show a CONFIG_VALIDATION error
 *  - Message tells user to run sbt init first
 */
import { runCli, assertContains, log } from "../utils.js";

export const name = "sbt plugin — without config file (shows CONFIG_VALIDATION error)";

export function run(targetDir: string): void {
  // No sbt init — target dir has no config

  for (const subcmd of ["list", "add @sbtools/plugin-erd", "remove @sbtools/plugin-erd"]) {
    log.info(`plugin ${subcmd} (no config)`);
    const result = runCli(["plugin", ...subcmd.split(" ")], targetDir);

    log.output(result.combined);

    // Should exit non-zero
    if (result.exitCode === 0) {
      throw new Error(`expected non-zero exit for 'plugin ${subcmd}' with no config`);
    }

    // Should mention sbt init
    assertContains(result.combined, "sbt init");
  }
}
