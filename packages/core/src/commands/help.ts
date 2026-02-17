import { ui } from "@sbtools/sdk";
import type { SbtPluginCommand } from "@sbtools/sdk";
import { allCommands } from "../command-registry.js";

const CATEGORY_ORDER = ["Docker", "Database", "Code Generation", "Testing", "Docs", "Setup", "Plugins"];

function inferCategory(cmdName: string): string {
  if (cmdName.startsWith("generate-")) return "Code Generation";
  if (cmdName === "test") return "Testing";
  if (cmdName.includes("docs")) return "Docs";
  return "Plugins";
}

export function showHelp(pluginCommands: { plugin: string; cmd: SbtPluginCommand }[]): void {
  const byCategory = new Map<string, { name: string; description: string; source?: string }[]>();

  for (const entry of allCommands()) {
    const list = byCategory.get(entry.category) ?? [];
    list.push({ name: entry.name, description: entry.description });
    byCategory.set(entry.category, list);
  }

  // Add help command
  const setupList = byCategory.get("Setup") ?? [];
  setupList.push({ name: "help", description: "Show this help" });
  byCategory.set("Setup", setupList);

  // Add plugin commands not yet covered
  for (const { plugin, cmd } of pluginCommands) {
    const category = inferCategory(cmd.name);
    const list = byCategory.get(category) ?? [];
    // Avoid duplicate entries (e.g. core already has generate-atlas)
    if (list.some((c) => c.name === cmd.name)) continue;
    list.push({ name: cmd.name, description: cmd.description, source: plugin });
    byCategory.set(category, list);
  }

  // Sort each category's list by name
  for (const list of byCategory.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  ui.log(`
supabase-tools — Portable Supabase development toolkit

Usage:
  sbt <command> [options]
`);

  for (const category of CATEGORY_ORDER) {
    const commands = byCategory.get(category);
    if (!commands || commands.length === 0) continue;

    ui.heading(`\n${category}:`);
    for (const c of commands) {
      const suffix = c.source ? `  (${c.source})` : "";
      ui.detail(`  ${c.name.padEnd(18)}${c.description}${suffix}`);
    }
  }

  ui.blank();
}
