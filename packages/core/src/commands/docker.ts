/**
 * Docker compose commands for start/stop/restart.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { SbtError, ui } from "@sbtools/sdk";
import { config } from "../config.js";
import { COMPOSE_DB_FILE } from "@sbtools/sdk";
import { ensureDirs, writeComposeEnv } from "./init.js";

const COMPOSE_DB = path.join(config.toolsDir, COMPOSE_DB_FILE);
const SBT_ENV_FILE = path.join(config.sbtDataDir, ".env");

function run(cmd: string): void {
  try {
    execSync(cmd, { stdio: "inherit", cwd: config.toolsDir, env: { ...process.env } });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer })?.stderr?.toString().trim();
    if (
      stderr?.includes("docker") ||
      stderr?.includes("pipe") ||
      stderr?.includes("daemon")
    ) {
      throw new SbtError("DOCKER_NOT_RUNNING", "Docker is not running.", {
        tips: ["Start Docker Desktop and try again."],
        cause: err,
      });
    }
    throw new SbtError("COMMAND_FAILED", `Command failed: ${cmd}`, { cause: err });
  }
}

/** Start Docker compose services. */
export function runStart(): void {
  ensureDirs();
  writeComposeEnv();
  run(`docker compose -f "${COMPOSE_DB}" --env-file "${SBT_ENV_FILE}" up -d`);
  ui.blank();
  ui.detail("Note: The 'db-init' container is a one-shot DB bootstrapper —");
  ui.detail("      if it shows as 'Exited (0)' that is normal and expected.");
}

/** Stop Docker compose services. */
export function runStop(): void {
  ensureDirs();
  writeComposeEnv();
  run(`docker compose -f "${COMPOSE_DB}" --env-file "${SBT_ENV_FILE}" down`);
}

/** Restart Docker compose services. */
export function runRestart(): void {
  ensureDirs();
  writeComposeEnv();
  run(`docker compose -f "${COMPOSE_DB}" --env-file "${SBT_ENV_FILE}" restart`);
}
