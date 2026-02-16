import path from "node:path";
import { createRequire } from "node:module";
import { ui, DatabaseError, hasFlag } from "@sbtools/sdk";

const require = createRequire(import.meta.url);
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";
import { runLiveTests } from "./runner-live.js";
import { runMemTests } from "./runner-mem.js";

/** Resolve test and migration directories from plugin context. */
export function resolveTestPaths(ctx: PluginContext): { testsDir: string; migrationsDir: string } {
  const testsDir = (ctx.pluginConfig.testsDir as string) ??
    path.join(ctx.projectRoot, "supabase", "tests");
  const migrationsDir = (ctx.pluginConfig.migrationsDir as string) ??
    ctx.paths.migrations;
  return { testsDir, migrationsDir };
}

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-db-test",
  version: (require("../package.json") as { version: string }).version,

  commands: [
    {
      name: "test",
      description: "Run database tests (pgTAP). Use --mem for in-memory PGlite mode.",
      async run(args: string[], ctx: PluginContext): Promise<void> {
        const { testsDir, migrationsDir } = resolveTestPaths(ctx);

        const useMem = hasFlag(args, "--mem") || hasFlag(args, "--memory");

        try {
          if (useMem) {
            await runMemTests(testsDir, migrationsDir);
          } else {
            const dbUrl =
              process.env.DATABASE_URL ||
              process.env.SUPABASE_DB_URL ||
              process.env.POSTGRES_URL ||
              "postgresql://postgres:postgres@localhost:54322/postgres";
            await runLiveTests(dbUrl, testsDir);
          }
        } catch (error) {
          throw new DatabaseError(
            `Error running tests: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
          );
        }
      },
    },
  ],
};

export default plugin;
