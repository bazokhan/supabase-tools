/**
 * CLI argument helpers shared by all plugins.
 *
 * Previously each plugin reimplemented these. Now they live in the SDK
 * so plugins import from "@sbtools/sdk" instead of duplicating.
 */
import { execSync } from "node:child_process";

/**
 * Returns true if the args array contains any of the given flags (e.g. "--json", "--help").
 */
export function hasFlag(args: string[], ...flags: string[]): boolean {
  return flags.some((flag) => args.includes(flag));
}

/**
 * Returns the value after a flag (e.g. getArg(args, "--port") → "8080"),
 * or undefined if the flag is absent or has no following value.
 */
export function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

/**
 * Opens a file or URL in the system's default application.
 * Works cross-platform (macOS, Linux, Windows).
 */
export function openFile(target: string): void {
  const cmd =
    process.platform === "darwin"
      ? `open "${target}"`
      : process.platform === "win32"
        ? `start "" "${target}"`
        : `xdg-open "${target}"`;
  try {
    execSync(cmd, { stdio: "ignore" });
  } catch {
    // Best-effort — not critical if the open fails
  }
}
