/**
 * Command registry — single source of truth for core and plugin commands.
 * Fixes S6, S9: no duplicate CORE_COMMANDS array; preflight can attach checks.
 */
export interface CommandEntry {
  name: string;
  description: string;
  category: string;
  /** run receives args and optional context (for commands like docs that need plugin access). */
  run: (args: string[], ctx?: unknown) => Promise<void>;
}

const registry = new Map<string, CommandEntry>();

export function registerCommand(entry: CommandEntry): void {
  registry.set(entry.name, entry);
}

export function getCommand(name: string): CommandEntry | undefined {
  return registry.get(name);
}

export function allCommands(): CommandEntry[] {
  return [...registry.values()];
}
