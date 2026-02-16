import path from "node:path";
import { ui, DatabaseError, hasFlag, resolveDbUrl, loadPackageVersion, resolveConfigPath, withHelp } from "@sbtools/sdk";
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";
import { runLiveTests } from "./runner-live.js";
import { runMemTests } from "./runner-mem.js";

/** Resolve test and migration directories from plugin context. */
export function resolveTestPaths(ctx: PluginContext): { testsDir: string; migrationsDir: string } {
  const testsDir = resolveConfigPath(ctx, "testsDir", "supabase/tests");
  const migrationsDir = resolveConfigPath(ctx, "migrationsDir", ctx.paths.migrations);
  return { testsDir, migrationsDir };
}

const TEST_HELP = `
test — Run database tests (pgTAP)

Usage:
  sbt test              Run tests against the running database
  sbt test --mem        Run tests in-memory with PGlite (no DB required)

Options:
  --mem, --memory       Use PGlite in-memory mode
  -h, --help            Show help
`;

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-db-test",
  version: loadPackageVersion(import.meta.url),

  commands: [
    {
      name: "test",
      description: "Run database tests (pgTAP). Use --mem for in-memory PGlite mode.",
      run: withHelp(TEST_HELP, async (args: string[], ctx: PluginContext): Promise<void> => {
        const { testsDir, migrationsDir } = resolveTestPaths(ctx);

        const useMem = hasFlag(args, "--mem") || hasFlag(args, "--memory");

        try {
          if (useMem) {
            await runMemTests(testsDir, migrationsDir);
          } else {
            await runLiveTests(resolveDbUrl(), testsDir);
          }
        } catch (error) {
          throw new DatabaseError(
            `Error running tests: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
          );
        }
      }),
    },
  ],
};

export default plugin;
