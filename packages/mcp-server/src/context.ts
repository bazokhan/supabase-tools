import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { PluginContext } from "@sbtools/sdk";

interface SbtConfig {
  paths?: {
    migrations?: string;
    snapshot?: string;
    docsOutput?: string;
    functions?: string;
  };
  api?: {
    url?: string;
  };
}

function findProjectRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, "supabase-tools.config.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return startDir; // fallback to cwd if config not found
}

export function buildContext(cwdOverride?: string): PluginContext {
  const cwd = cwdOverride ?? process.cwd();
  const projectRoot = findProjectRoot(cwd);

  let config: SbtConfig = {};
  const configPath = path.join(projectRoot, "supabase-tools.config.json");
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf8")) as SbtConfig;
    } catch {
      // use defaults on parse error
    }
  }

  const sbtDataDir = path.join(projectRoot, ".sbt");
  // toolsDir points to the mcp-server package root; studio tools don't use it
  const toolsDir = fileURLToPath(new URL("../..", import.meta.url));

  return {
    projectRoot,
    toolsDir,
    sbtDataDir,
    artifactsDir: path.join(sbtDataDir, "artifacts"),
    pluginConfig: {},
    apiUrl: config.api?.url ?? "http://localhost:54321",
    paths: {
      migrations: path.resolve(projectRoot, config.paths?.migrations ?? "supabase/migrations"),
      snapshot: path.resolve(projectRoot, config.paths?.snapshot ?? ".sbt/snapshot"),
      docsOutput: path.resolve(projectRoot, config.paths?.docsOutput ?? ".sbt/docs"),
      functions: path.resolve(projectRoot, config.paths?.functions ?? "supabase/functions"),
    },
  };
}
