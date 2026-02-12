/**
 * Centralized CLI output helpers for supabase-tools.
 *
 * Provides semantic output functions with ANSI colors when running in
 * an interactive terminal, and plain text when piped.
 *
 * Usage:
 *   import { ui } from "@sbtools/sdk";
 *   ui.info("Connecting to database...");
 *   ui.success("Done!");
 *   ui.warn("Snapshot missing, skipping atlas.");
 *   ui.error("Could not parse config");
 */

// ---------------------------------------------------------------------------
// Color support
// ---------------------------------------------------------------------------

const stdoutTTY = process.stdout.isTTY ?? false;
const stderrTTY = process.stderr.isTTY ?? false;

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";

function colorOut(code: string, text: string): string {
  return stdoutTTY ? `${code}${text}${RESET}` : text;
}

function colorErr(code: string, text: string): string {
  return stderrTTY ? `${code}${text}${RESET}` : text;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const ui = {
  /** Neutral informational message → stdout. */
  info(msg: string): void {
    console.log(msg);
  },

  /** Positive completion / success message → stdout (green). */
  success(msg: string): void {
    console.log(colorOut(GREEN, msg));
  },

  /** Warning → stderr (yellow). */
  warn(msg: string): void {
    console.warn(colorErr(YELLOW, msg));
  },

  /** Error message → stderr (red). */
  error(msg: string): void {
    console.error(colorErr(RED, msg));
  },

  /** Sub-item or indented detail line → stdout (dim). */
  detail(msg: string): void {
    console.log(colorOut(DIM, msg));
  },

  /** Section heading → stdout (bold). */
  heading(msg: string): void {
    console.log(colorOut(BOLD, msg));
  },

  /** Progress step ("Doing X…") → stdout (cyan). */
  step(msg: string): void {
    console.log(colorOut(CYAN, msg));
  },

  /** Horizontal separator line → stdout (dim). */
  separator(): void {
    console.log(colorOut(DIM, "━".repeat(78)));
  },

  /** Empty line → stdout. */
  blank(): void {
    console.log("");
  },

  /**
   * Raw passthrough → stdout, no color.
   * Use for dynamic data (TAP output, SQL results, multi-line blocks).
   */
  log(msg: string): void {
    console.log(msg);
  },

  /**
   * Aligned key-value table → stdout.
   *
   * ```ts
   * ui.table([
   *   ["API URL", "http://localhost:54321"],
   *   ["DB URL",  "postgresql://..."],
   * ]);
   * ```
   */
  table(rows: [string, string][], indent = 0): void {
    if (rows.length === 0) return;
    const maxKey = Math.max(...rows.map(([k]) => k.length));
    const pad = " ".repeat(indent);
    for (const [key, value] of rows) {
      console.log(`${pad}${colorOut(DIM, key.padEnd(maxKey))}  ${value}`);
    }
  },

  /**
   * Print a list of detail lines, each prefixed with `   ✓ `.
   */
  itemList(items: string[]): void {
    for (const item of items) {
      console.log(colorOut(DIM, `   ✓ ${item}`));
    }
  },

  /**
   * Print an error block with message and optional tips.
   * Writes to stderr.
   */
  errorBlock(headline: string, message?: string, tips?: string[]): void {
    console.error(colorErr(RED, `\n❌ ${headline}`));
    if (message) {
      console.error(colorErr(RED, `   ${message}`));
    }
    if (tips && tips.length > 0) {
      console.error(colorErr(YELLOW, "\n💡 Tips:"));
      for (const tip of tips) {
        console.error(colorErr(YELLOW, `   - ${tip}`));
      }
    }
  },
};
