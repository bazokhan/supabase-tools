import { ui } from "@sbtools/sdk";
import type { SbtPluginCommand } from "@sbtools/sdk";

/** Core command metadata for help display. */
interface CommandMeta {
  name: string;
  description: string;
  category: string;
}

const CORE_COMMANDS: CommandMeta[] = [
  { name: "start", description: "Start all Supabase Docker services", category: "Docker" },
  { name: "stop", description: "Stop all services", category: "Docker" },
  { name: "restart", description: "Restart all services", category: "Docker" },
  { name: "status", description: "Show service URLs, keys, and connection info", category: "Docker" },
  { name: "migrate", description: "Apply SQL migrations to running DB", category: "Database" },
  { name: "snapshot", description: "Export DB objects (functions, views, etc.) to filesystem", category: "Database" },
  { name: "generate-atlas", description: "Generate the Backend Atlas HTML visualization", category: "Code Generation" },
  { name: "docs", description: "Generate atlas + start Swagger UI, ReDoc, SchemaSpy", category: "Docs" },
  { name: "init", description: "Generate supabase-tools.config.json with defaults", category: "Setup" },
  { name: "help", description: "Show this help", category: "Setup" },
];

const CATEGORY_ORDER = ["Docker", "Database", "Code Generation", "Testing", "Docs", "Setup", "Plugins"];

function inferCategory(cmdName: string): string {
  if (cmdName.startsWith("generate-") || cmdName === "atlas-html") return "Code Generation";
  if (cmdName === "test") return "Testing";
  if (cmdName.includes("docs")) return "Docs";
  return "Plugins";
}

export function showHelp(pluginCommands: { plugin: string; cmd: SbtPluginCommand }[]): void {
  const pluginNames = new Set(pluginCommands.map((pc) => pc.cmd.name));

  // Build category -> commands map (avoid duplicating core commands that are also plugin-provided)
  const byCategory = new Map<string, { name: string; description: string; source?: string }[]>();

  for (const meta of CORE_COMMANDS) {
    // Skip core entries for commands that come from plugins (plugin wins for description)
    if (meta.name === "generate-atlas" && pluginNames.has("atlas-html")) {
      // generate-atlas is core-orchestrated, always show
    }
    if (pluginNames.has(meta.name) && meta.category !== "Docker" && meta.category !== "Database" && meta.category !== "Setup") {
      // Prefer plugin's description
      continue;
    }
    const list = byCategory.get(meta.category) ?? [];
    list.push({ name: meta.name, description: meta.description });
    byCategory.set(meta.category, list);
  }

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
