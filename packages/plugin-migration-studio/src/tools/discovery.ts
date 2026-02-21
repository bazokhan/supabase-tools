import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { LoadedToolDefinition, ToolModuleLike } from "./tool-definition.js";

function collectToolFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectToolFiles(full));
      continue;
    }
    if (/\.tool\.(?:js|ts|mjs|cjs)$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

async function importToolFile(filePath: string): Promise<LoadedToolDefinition> {
  const mod = await import(pathToFileURL(filePath).href) as ToolModuleLike;
  const tool = mod.tool ?? mod.default;
  if (!tool) throw new Error(`Tool module ${filePath} does not export 'tool'`);
  if (!mod.metadata) throw new Error(`Tool module ${filePath} does not export 'metadata'`);
  return { ...tool, metadata: mod.metadata };
}

export async function discoverTools(): Promise<LoadedToolDefinition[]> {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const modulesDir = path.join(thisDir, "modules");
  if (!fs.existsSync(modulesDir)) return [];
  const files = collectToolFiles(modulesDir).sort((a, b) => a.localeCompare(b));
  const tools = await Promise.all(files.map((file) => importToolFile(file)));
  const ids = new Set<string>();
  for (const t of tools) {
    if (ids.has(t.id)) throw new Error(`Duplicate tool id: ${t.id}`);
    ids.add(t.id);
  }
  return tools;
}

export const STUDIO_TOOLS = await discoverTools();

export const STUDIO_TOOLS_BY_ID = new Map(STUDIO_TOOLS.map((t) => [t.id, t]));

export const STUDIO_TOOLS_BY_COMMAND = new Map(
  STUDIO_TOOLS
    .filter((t) => t.cli)
    .map((t) => [t.cli!.command, t])
);

export const STUDIO_TOOLS_BY_ROUTE = new Map(
  STUDIO_TOOLS
    .filter((t) => t.http)
    .map((t) => [`${t.http!.method}:${t.http!.path}`, t])
);

