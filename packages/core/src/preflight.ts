/**
 * Pre-flight checks for CLI commands.
 *
 * Before dispatching a command we verify that every file and directory it
 * needs actually exists.  When something is missing we print a single,
 * actionable message ("Run `sbt snapshot` first") instead of letting the
 * script crash with an opaque ENOENT deep in a call-stack.
 */
import fs from "node:fs";
import path from "node:path";
import { SbtError, COMPOSE_DB_FILE } from "@sbtools/sdk";
import { config, resolve } from "./config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Check {
  /** Absolute path that must exist. */
  path: string;
  /** What we call this file/directory in the error message. */
  label: string;
  /** Actionable hint shown when the check fails. */
  fix: string;
  /** "file" or "dir" — defaults to auto-detect (existence only). */
  kind?: "file" | "dir";
}

// ---------------------------------------------------------------------------
// Reusable check builders
// ---------------------------------------------------------------------------

const composeDb = (): Check => ({
  path: path.join(config.toolsDir, COMPOSE_DB_FILE),
  label: "Docker Compose DB config",
  fix: "This file ships with supabase-tools. Re-clone or restore it.",
  kind: "file",
});

const snapshotMeta = (): Check => ({
  path: path.join(resolve(config.paths.snapshot), "_meta", "snapshot.json"),
  label: "DB snapshot metadata",
  fix: "Run `sbt snapshot` first to export the current database objects.",
  kind: "file",
});

const migrationsDir = (): Check => ({
  path: resolve(config.paths.migrations),
  label: "Migrations directory",
  fix: `Create the directory at ${config.paths.migrations} or run \`sbt init\`.`,
  kind: "dir",
});

const atlasDataFile = (): Check => ({
  path: path.join(resolve(config.paths.docsOutput), "backend-atlas-data.json"),
  label: "backend-atlas-data.json",
  fix: "Run `sbt generate-atlas` first to generate the atlas data.",
  kind: "file",
});

// ---------------------------------------------------------------------------
// Command → checks mapping
// ---------------------------------------------------------------------------

function checksForCommand(command: string, args: string[]): Check[] {
  switch (command) {
    case "start":
    case "restart":
      return [composeDb()];

    case "status":
      return [composeDb()];

    case "migrate":
      return [migrationsDir()];

    case "watch":
      return [migrationsDir()];

    case "snapshot":
      return [composeDb()];

    case "generate-types":
      return [composeDb()];

    case "generate-atlas":
      return [snapshotMeta()];

    case "docs":
      return [composeDb()];

    case "atlas-html":
      return [atlasDataFile()];

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run pre-flight checks for `command`.  If any check fails, print all
 * failures with actionable messages and exit with code 1.
 */
export function preflight(command: string, args: string[]): void {
  const checks = checksForCommand(command, args);
  if (checks.length === 0) return;

  const failures: { label: string; fix: string }[] = [];

  for (const check of checks) {
    if (!fs.existsSync(check.path)) {
      failures.push({ label: check.label, fix: check.fix });
    }
  }

  if (failures.length === 0) return;

  const lines = failures.map(({ label, fix }) => `  • ${label} — ${fix}`);
  throw new SbtError(
    "PREFLIGHT_FAILED",
    `Pre-flight check failed for \`sbt ${command}\`:\n\n${lines.join("\n")}`,
  );
}
