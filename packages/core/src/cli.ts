#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ui, SbtError, handleError } from "@sbtools/sdk";
import type { SbtPluginCommand } from "@sbtools/sdk";
import { config, resolve } from "./config.js";
import { loadPlugins, buildPluginContext } from "./plugin-loader.js";
import { preflight } from "./preflight.js";
import { runSnapshot } from "./commands/snapshot.js";
import { runGenerateData } from "./commands/generate-data.js";
import { runMigrate } from "./commands/migrate.js";
import { runStatus } from "./commands/status.js";
import { showHelp } from "./commands/help.js";

const command = process.argv[2];
const args = process.argv.slice(3);

const COMPOSE_DB = path.join(config.toolsDir, "docker-compose.db.yml");
const COMPOSE_DOCS = path.join(config.toolsDir, "docker-compose.api-docs.yml");
const SBT_ENV_FILE = path.join(config.sbtDataDir, ".env");

function run(cmd: string): void {
  try {
    execSync(cmd, { stdio: "inherit", cwd: config.toolsDir, env: { ...process.env } });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer })?.stderr?.toString().trim();
    if (stderr?.includes("docker") || stderr?.includes("pipe") || stderr?.includes("daemon")) {
      throw new SbtError("DOCKER_NOT_RUNNING", "Docker is not running.", {
        tips: ["Start Docker Desktop and try again."], cause: err,
      });
    }
    throw new SbtError("COMMAND_FAILED", `Command failed: ${cmd}`, { cause: err });
  }
}

function ensureProjectDirs(): void {
  const functionsDir = resolve(config.paths.functions);
  fs.mkdirSync(functionsDir, { recursive: true });
  const fnEnvFile = path.join(functionsDir, ".env");
  if (!fs.existsSync(fnEnvFile)) {
    fs.writeFileSync(fnEnvFile, "# Edge function environment variables\n", "utf8");
  }
  const docsAbsolute = resolve(config.paths.docsOutput);
  fs.mkdirSync(docsAbsolute, { recursive: true });
  fs.mkdirSync(config.sbtDataDir, { recursive: true });
  fs.mkdirSync(path.join(config.sbtDataDir, "schemaspy-out"), { recursive: true });
  const containerPrefix = config.project.name
    .replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "sbt";
  const functionsAbs = path.resolve(config.projectRoot, config.paths.functions);
  const openapiSpec = path.join(config.sbtDataDir, "openapi-spec.json");
  const schemaspyOut = path.join(config.sbtDataDir, "schemaspy-out");
  const composeEnv = path.join(config.sbtDataDir, ".env");
  const envContent = [
    `SBT_PREFIX=${containerPrefix}`,
    `SBT_DOCS_DIR=${docsAbsolute}`,
    `SBT_FUNCTIONS_DIR=${functionsAbs}`,
    `SBT_OPENAPI_SPEC=${openapiSpec}`,
    `SBT_SCHEMASPY_OUT=${schemaspyOut}`,
  ].join("\n") + "\n";
  fs.writeFileSync(composeEnv, envContent, "utf8");
}

function init(): void {
  const configPath = path.join(config.projectRoot, "supabase-tools.config.json");
  if (fs.existsSync(configPath)) {
    ui.info(`Config already exists at ${configPath}`);
    ensureProjectDirs();
    return;
  }
  const projectName = (() => {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(config.projectRoot, "package.json"), "utf8"));
      return pkg.name || path.basename(config.projectRoot);
    } catch { return path.basename(config.projectRoot); }
  })();
  const defaultConfig = {
    paths: { migrations: "supabase/migrations", snapshot: "supabase/current",
      docsOutput: "docs", functions: "supabase/functions" },
    db: { url: "postgresql://postgres:postgres@localhost:54322/postgres", container: "supabase-db" },
    api: { url: "http://localhost:54321", studioUrl: "http://localhost:54323", inbucketUrl: "http://localhost:54324" },
    project: { name: projectName }, plugins: [],
  };
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2) + "\n", "utf8");
  ui.success(`Created ${configPath}`);
  ensureProjectDirs();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

try {
  const loaded = await loadPlugins();
  const pluginCommands = loaded.flatMap((entry) =>
    (entry.plugin.commands ?? []).map((cmd) => ({ plugin: entry.plugin.name, cmd, loaded: entry }))
  );

  if (command) preflight(command, args);

  switch (command) {
    case "start":
      ensureProjectDirs();
      run(`docker compose -f "${COMPOSE_DB}" --env-file "${SBT_ENV_FILE}" up -d`);
      await runStatus();
      break;

    case "stop":
      ensureProjectDirs();
      run(`docker compose -f "${COMPOSE_DB}" --env-file "${SBT_ENV_FILE}" down`);
      try { execSync(`docker compose -f "${COMPOSE_DOCS}" --env-file "${SBT_ENV_FILE}" down`, { stdio: "inherit", cwd: config.toolsDir }); } catch { /* ok */ }
      break;

    case "restart":
      ensureProjectDirs();
      run(`docker compose -f "${COMPOSE_DB}" --env-file "${SBT_ENV_FILE}" restart`);
      break;

    case "status":
      await runStatus();
      break;

    case "migrate":
      await runMigrate();
      break;

    case "snapshot":
      await runSnapshot();
      break;

    case "generate-atlas": {
      await runGenerateData();
      // Invoke atlas-html plugin if loaded
      const atlasCmd = pluginCommands.find((pc) => pc.cmd.name === "atlas-html");
      if (atlasCmd) {
        const ctx = buildPluginContext(atlasCmd.loaded, loaded);
        await atlasCmd.cmd.run(args, ctx);
      }
      break;
    }

    case "docs":
      if (args.includes("stop")) {
        ensureProjectDirs();
        run(`docker compose -f "${COMPOSE_DOCS}" --env-file "${SBT_ENV_FILE}" down`);
      } else {
        ensureProjectDirs();
        // Auto-generate snapshot if missing
        const metaFile = path.join(resolve(config.paths.snapshot), "_meta", "snapshot.json");
        if (!fs.existsSync(metaFile)) {
          ui.step("📸 Snapshot not found. Generating DB snapshot first...\n");
          try { await runSnapshot(); } catch { ui.warn("⚠️  Snapshot generation failed. Continuing...\n"); }
        }
        // Generate atlas data + HTML
        ui.step("📊 Generating atlas visualization...\n");
        try {
          await runGenerateData();
          const atlasCmd = pluginCommands.find((pc) => pc.cmd.name === "atlas-html");
          if (atlasCmd) await atlasCmd.cmd.run([], buildPluginContext(atlasCmd.loaded, loaded));
        } catch { ui.warn("⚠️  Atlas generation skipped.\n"); }
        // Generate ERD
        const erdCmd = pluginCommands.find((pc) => pc.cmd.name === "generate-erd");
        if (erdCmd) {
          ui.step("📐 Generating ERD diagrams...\n");
          try { await erdCmd.cmd.run([], buildPluginContext(erdCmd.loaded, loaded)); } catch { ui.warn("⚠️  ERD generation skipped.\n"); }
        }
        // Start docs server
        const docsCmd = pluginCommands.find((pc) => pc.cmd.name === "start-docs-server");
        if (docsCmd) {
          await docsCmd.cmd.run([], buildPluginContext(docsCmd.loaded, loaded));
        }
      }
      break;

    case "init":
      init();
      break;

    case "help": case "--help": case "-h": case undefined:
      showHelp(pluginCommands);
      break;

    default: {
      const match = pluginCommands.find((pc) => pc.cmd.name === command);
      if (match) {
        const ctx = buildPluginContext(match.loaded, loaded);
        await match.cmd.run(args, ctx);
      } else {
        ui.error(`Unknown command: ${command}\n`);
        showHelp(pluginCommands);
        process.exit(1);
      }
    }
  }
} catch (error) {
  handleError(error);
}
