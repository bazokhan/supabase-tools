/**
 * @sbtools/plugin-frontend-usage
 *
 * Scans frontend .ts/.tsx/.js/.jsx files for Supabase SDK usage and
 * generates an interactive HTML report + integrates with Backend Atlas.
 */
import fs from "node:fs";
import path from "node:path";
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";
import { hasFlag, openFile, ui, loadPackageVersion, getConfigStringArray, withHelp } from "@sbtools/sdk";
import { scanDirectory } from "./scanner.js";
import { analyze } from "./analyzer.js";
import { writeFrontendUsageArtifact } from "./artifact.js";
import { generateHtml } from "./html-generator.js";
import { getFrontendUsageAtlasUI } from "./atlas.js";

function getScanPaths(ctx: PluginContext): string[] {
  return getConfigStringArray(ctx, "scanPaths", ["src/"]);
}

function getOutputPath(ctx: PluginContext): string {
  return path.join(ctx.paths.docsOutput, "frontend-usage.html");
}

const FRONTEND_USAGE_HELP = `
frontend-usage — Scan frontend code for Supabase SDK usage

Usage:
  sbt frontend-usage [options]

Options:
  --json       Output raw JSON to stdout
  --no-open    Skip opening the report in browser
  -h, --help   Show this help

Scans .ts/.tsx/.js/.jsx files for:
  - .from("table")           Table queries
  - .rpc("fn")               RPC calls
  - .auth.*                  Auth methods
  - .storage.from("bucket")   Storage
  - .functions.invoke("fn")   Edge functions
  - fetch(".../rest/v1/...") REST API calls
  - fetch(".../functions/v1/...") Edge function fetch

Config (supabase-tools.config.json → plugins[].config):
  scanPaths    Directories to scan (default: ["src/"])
`;

async function frontendUsageCommand(args: string[], ctx: PluginContext): Promise<void> {
  const scanPaths = getScanPaths(ctx);
  const results = scanDirectory(ctx.projectRoot, scanPaths);
  const data = analyze(results);
  writeFrontendUsageArtifact(ctx, data, { scanPaths, pluginVersion: loadPackageVersion(import.meta.url) });

  if (hasFlag(args, "--json")) {
    ui.log(
      JSON.stringify(
        { data, scanResults: results.map((r) => ({ ...r, hits: r.hits })) },
        null,
        2,
      ),
    );
    return;
  }

  const outputPath = getOutputPath(ctx);
  const html = generateHtml(data, results);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, "utf-8");

  const tableCount = data.byResource.table?.length ?? 0;
  const rpcCount = data.byResource.rpc?.length ?? 0;
  const fnCount = data.byResource.edge_function?.length ?? 0;
  ui.info(`Frontend usage report written to ${outputPath}`);
  ui.detail(
    `${Object.keys(data.components).length} components use ${tableCount} tables, ${rpcCount} RPCs, ${fnCount} edge functions`,
  );

  if (!hasFlag(args, "--no-open")) {
    openFile(outputPath);
  }
}

function toAtlasItems(data: Awaited<ReturnType<typeof analyze>>): Array<{
  component: string;
  hitCount: number;
  resources: Array<{ type: string; resource: string }>;
}> {
  return Object.entries(data.components).map(([component, hits]) => {
    const seen = new Set<string>();
    const resources: Array<{ type: string; resource: string }> = [];
    for (const h of hits) {
      const key = `${h.type}:${h.resource}`;
      if (!seen.has(key)) {
        seen.add(key);
        resources.push({ type: h.type, resource: h.resource });
      }
    }
    return { component, hitCount: hits.length, resources };
  });
}

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-frontend-usage",
  version: loadPackageVersion(import.meta.url),
  artifactCapabilities: {
    produces: ["frontend.usage"],
    consumes: [],
  },

  commands: [
    {
      name: "frontend-usage",
      description: "Scan frontend code for Supabase SDK usage, generate HTML report",
      run: withHelp(FRONTEND_USAGE_HELP, frontendUsageCommand),
    },
  ],

  getAtlasData: async (ctx: PluginContext) => {
    const scanPaths = getScanPaths(ctx);
    const results = scanDirectory(ctx.projectRoot, scanPaths);
    const data = analyze(results);
    // Artifact is written by command - skip here to avoid redundant writes
    const items = toAtlasItems(data);

    const tableCount = data.byResource.table?.length ?? 0;
    const rpcCount = data.byResource.rpc?.length ?? 0;
    const componentCount = Object.keys(data.components).length;

    return {
      categories: { frontend_usage: items },
      stats: [
        { label: "Components", value: componentCount },
        { label: "Tables Used", value: tableCount },
        { label: "RPCs Used", value: rpcCount },
      ],
    };
  },

  getAtlasUI: () => getFrontendUsageAtlasUI(),

  getStatusLines: async (ctx: PluginContext) => {
    const scanPaths = getScanPaths(ctx);
    const results = scanDirectory(ctx.projectRoot, scanPaths);
    const data = analyze(results);
    // Artifact is written by command - skip here to avoid redundant writes
    const compCount = Object.keys(data.components).length;
    const tableCount = data.byResource.table?.length ?? 0;
    const rpcCount = data.byResource.rpc?.length ?? 0;
    return [
      `  Frontend: ${compCount} components use ${tableCount} tables, ${rpcCount} RPCs`,
    ];
  },
};

export default plugin;