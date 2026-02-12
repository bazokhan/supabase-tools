/**
 * Structured error classes for supabase-tools.
 *
 * Every error carries a machine-readable `code`, a human-readable `message`,
 * optional actionable `tips`, and an `exitCode`.  The `handleError()` utility
 * at the bottom of this file formats any error (SbtError or plain Error)
 * through the `ui` module and calls `process.exit()`.
 */
import { ui } from "./ui.js";

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export type SbtErrorCode =
  | "CONFIG_PARSE"
  | "CONFIG_VALIDATION"
  | "SNAPSHOT_MISSING"
  | "SNAPSHOT_FAILED"
  | "DATABASE_CONNECTION"
  | "DATABASE_QUERY"
  | "PLUGIN_LOAD"
  | "PLUGIN_HOOK"
  | "DOCKER_NOT_RUNNING"
  | "COMMAND_FAILED"
  | "PREFLIGHT_FAILED";

// ---------------------------------------------------------------------------
// Base class
// ---------------------------------------------------------------------------

export class SbtError extends Error {
  /** Machine-readable error code. */
  readonly code: SbtErrorCode;

  /** Actionable hints shown below the error message. */
  readonly tips?: string[];

  /** Process exit code (default 1). */
  readonly exitCode: number;

  constructor(
    code: SbtErrorCode,
    message: string,
    opts?: { tips?: string[]; exitCode?: number; cause?: unknown },
  ) {
    super(message, { cause: opts?.cause });
    this.name = "SbtError";
    this.code = code;
    this.tips = opts?.tips;
    this.exitCode = opts?.exitCode ?? 1;
  }
}

// ---------------------------------------------------------------------------
// Subclasses
// ---------------------------------------------------------------------------

/** Config file could not be parsed as JSON. */
export class ConfigError extends SbtError {
  constructor(message: string, opts?: { cause?: unknown; tips?: string[] }) {
    super("CONFIG_VALIDATION", message, opts);
    this.name = "ConfigError";
  }
}

/** DB snapshot is missing or could not be generated. */
export class SnapshotError extends SbtError {
  constructor(message: string, opts?: { cause?: unknown; tips?: string[] }) {
    super("SNAPSHOT_FAILED", message, {
      tips: opts?.tips ?? [
        "Run `sbt snapshot` to export the current database objects.",
        "Ensure the database is running: `sbt start`",
      ],
      cause: opts?.cause,
    });
    this.name = "SnapshotError";
  }
}

/**
 * Database connection or query failure.
 * Automatically provides connection tips when the message looks like a
 * connectivity problem.
 */
export class DatabaseError extends SbtError {
  constructor(message: string, opts?: { cause?: unknown; tips?: string[] }) {
    const isConnectIssue =
      /connect|ECONNREFUSED|timeout|ENOTFOUND/i.test(message);
    super(isConnectIssue ? "DATABASE_CONNECTION" : "DATABASE_QUERY", message, {
      tips: opts?.tips ??
        (isConnectIssue
          ? [
              "Ensure Supabase is running: `sbt start`",
              "Check DATABASE_URL environment variable",
              "Verify connection string format",
            ]
          : undefined),
      cause: opts?.cause,
    });
    this.name = "DatabaseError";
  }
}

/** A plugin failed to load or a plugin hook threw. */
export class PluginError extends SbtError {
  /** Name of the plugin that failed (if known). */
  readonly pluginName: string;

  constructor(
    pluginName: string,
    message: string,
    opts?: { cause?: unknown; tips?: string[]; code?: SbtErrorCode },
  ) {
    super(opts?.code ?? "PLUGIN_HOOK", `Plugin "${pluginName}": ${message}`, {
      tips: opts?.tips,
      cause: opts?.cause,
    });
    this.name = "PluginError";
    this.pluginName = pluginName;
  }
}

// ---------------------------------------------------------------------------
// Top-level error handler
// ---------------------------------------------------------------------------

/**
 * Format any error through the `ui` module and exit.
 *
 * - `SbtError` instances are printed with their code, message, and tips.
 * - Plain `Error` instances get a generic format.
 * - Non-Error values are stringified.
 *
 * Set `SBT_DEBUG=1` to include the full stack trace.
 */
export function handleError(error: unknown): never {
  const debug = process.env.SBT_DEBUG === "1";

  if (error instanceof SbtError) {
    ui.errorBlock(error.message, undefined, error.tips);
    if (debug && error.stack) {
      ui.error(`\n${error.stack}`);
    }
    process.exit(error.exitCode);
  }

  if (error instanceof Error) {
    ui.errorBlock(error.message);
    if (debug && error.stack) {
      ui.error(`\n${error.stack}`);
    }
    process.exit(1);
  }

  ui.error(`\n❌ ${String(error)}`);
  process.exit(1);
}
