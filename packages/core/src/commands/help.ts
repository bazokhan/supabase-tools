import fs from "node:fs";
import path from "node:path";
import { ui } from "@sbtools/sdk";
import type { SbtPluginCommand } from "@sbtools/sdk";
import { allCommands } from "../command-registry.js";
import { config } from "../config.js";

const CATEGORY_ORDER = ["Docker", "Database", "Code Generation", "Testing", "Docs", "Setup", "Plugins"];

function inferCategory(cmdName: string): string {
  if (cmdName.startsWith("generate-")) return "Code Generation";
  if (cmdName === "test") return "Testing";
  if (cmdName.includes("docs")) return "Docs";
  return "Plugins";
}

export function showHelp(pluginCommands: { plugin: string; cmd: SbtPluginCommand }[]): void {
  // Check if config file exists
  const configPath = path.join(config.projectRoot, "supabase-tools.config.json");
  const configExists = fs.existsSync(configPath);

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

  // Show config-missing warning if applicable
  if (!configExists) {
    ui.warn(`⚠  No supabase-tools.config.json found.`);
    ui.detail(`   Run 'sbt init' to create one and set up your project.`);
    ui.blank();
  }

  // Show Quick Start section
  ui.heading(`Quick Start (first time):`);
  ui.detail(`  sbt init → sbt start → sbt snapshot → sbt generate-atlas → sbt dashboard`);
  ui.blank();

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
