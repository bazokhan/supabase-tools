import fs from "node:fs";
import path from "node:path";
import { loadPackageVersion, withHelp } from "@sbtools/sdk";
import type { DashboardView, PluginAtlasData, PluginContext, SbtPlugin } from "@sbtools/sdk";
import { runGenerateErd } from "./erd-command.js";
import { resolveErdOutput } from "./paths.js";

export { resolveErdOutput } from "./paths.js";

async function getErdAtlasData(ctx: PluginContext): Promise<PluginAtlasData> {
  const erdDir = resolveErdOutput(ctx);
  if (!fs.existsSync(erdDir)) return { categories: {}, stats: [] };

  const files = fs.readdirSync(erdDir).filter((f) => f.endsWith(".md"));
  const diagrams = files.map((f) => {
    const content = fs.readFileSync(path.join(erdDir, f), "utf8");
    const tableName = f.replace(/\.md$/, "");
    const mermaidMatch = content.match(/```mermaid\n([\s\S]*?)```/);
    const mermaid = mermaidMatch?.[1]?.trim() ?? "";
    return { table: tableName, mermaid, markdown: content };
  });

  return {
    categories: { erd_diagrams: diagrams },
    stats: [{ label: "ERD Diagrams", value: diagrams.length }],
  };
}

function getErdDashboardView(): DashboardView {
  return {
    sections: [
      {
        id: "erd",
        title: "Entity Relationship Diagrams",
        description: "Mermaid ERD diagrams for each table showing columns and foreign keys.",
        dataKey: "erd_diagrams",
        primaryKeyField: "table",
        layout: "summary-only",
      },
    ],
  };
}

const GENERATE_ERD_HELP = `
generate-erd — Generate Mermaid ERD diagrams for each public table

Usage:
  sbt generate-erd

Output: Creates entity-relations/*.md in docs output (configurable via erdOutput).
`;

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-erd",
  version: loadPackageVersion(import.meta.url),

  getAtlasData: getErdAtlasData,
  getDashboardView: getErdDashboardView,

  commands: [
    {
      name: "generate-erd",
      description: "Generate Mermaid ERD diagrams for each public table",
      run: withHelp(GENERATE_ERD_HELP, runGenerateErd),
    },
  ],
};

export default plugin;
