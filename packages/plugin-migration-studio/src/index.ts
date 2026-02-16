/**
 * @sbtools/plugin-migration-studio
 *
 * Migration authoring UI: create migrations, analyze SQL, apply via core flow.
 * Uses CodeMirror 6, schema-aware autocomplete (Phase 2), live analysis (Phase 3).
 */
import http from "node:http";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";
import { ui, hasFlag, getArg } from "@sbtools/sdk";
import { createRequestHandler } from "./server.js";

const require = createRequire(import.meta.url);
const PLUGIN_VERSION = (require("../package.json") as { version: string }).version;
const DEFAULT_PORT = 3335;

function killProcessOnPort(port: number): boolean {
  try {
    if (process.platform === "win32") {
      execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
        { stdio: "ignore", windowsHide: true }
      );
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || fuser -k ${port}/tcp 2>/dev/null || true`, {
        stdio: "ignore",
      });
    }
    return true;
  } catch {
    return false;
  }
}

async function migrationStudioCommand(args: string[], ctx: PluginContext): Promise<void> {
  if (hasFlag(args, "--help", "-h")) {
    console.log(`
migration-studio — Migration authoring UI

Usage:
  sbt migration-studio              Start the studio server (default port 3335)
  sbt migration-studio --port N     Use port N
  sbt migration-studio --restart    Kill existing server on port, then start

Options:
  -h, --help    Show this help
  --port N      HTTP server port (default: 3335)
  --restart     Kill process using the port before starting (cross-platform)
`);
    return;
  }

  const port = parseInt(getArg(args, "--port") ?? String(DEFAULT_PORT), 10) || DEFAULT_PORT;
  const doRestart = hasFlag(args, "--restart");

  if (doRestart) {
    killProcessOnPort(port);
    await new Promise((r) => setTimeout(r, 500));
  }

  const handler = createRequestHandler(ctx);
  const server = http.createServer(handler);

  function shutdown() {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 2000);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  function tryListen() {
    server.listen(port, () => {
      ui.success(`Migration Studio at http://localhost:${port}`);
      ui.detail("Press Ctrl+C to stop.");
    });
  }

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      ui.detail(`Port ${port} in use; killing existing process...`);
      killProcessOnPort(port);
      setTimeout(tryListen, 500);
    } else {
      throw err;
    }
  });

  tryListen();
}

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-migration-studio",
  version: PLUGIN_VERSION,
  artifactCapabilities: {
    produces: ["migration.studio.draft"],
    consumes: ["migration.analysis"],
  },
  commands: [
    {
      name: "migration-studio",
      description: "Migration authoring UI — create migrations, analyze SQL, apply via sbt migrate",
      run: migrationStudioCommand,
    },
  ],
};

export default plugin;
