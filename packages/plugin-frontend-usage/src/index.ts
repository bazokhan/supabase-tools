/**
 * @sbtools/plugin-frontend-usage
 *
 * Scans frontend .ts/.tsx/.js/.jsx files for Supabase SDK usage and
 * generates an interactive HTML report + integrates with Backend Atlas.
 */
import fs from "node:fs";
import path from "node:path";
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";
import { hasFlag, openFile } from "@sbtools/sdk";
import { scanDirectory } from "./scanner.js";
import { analyze } from "./analyzer.js";
import { generateHtml } from "./html-generator.js";
import { frontendUsageSectionHtml } from "./atlas/sections.js";
import { frontendUsageCardRendererJs } from "./atlas/cards.js";
import { frontendUsageStyles } from "./atlas/styles.js";

function getScanPaths(ctx: PluginContext): string[] {
  const configured = ctx.pluginConfig.scanPaths;
  if (Array.isArray(configured) && configured.length > 0) {
    return configured.map(String);
  }
  return ["src/"];
}

function getOutputPath(ctx: PluginContext): string {
  return path.join(ctx.docsOutput, "frontend-usage.html");
}

async function frontendUsageCommand(args: string[], ctx: PluginContext): Promise<void> {
  if (hasFlag(args, "--help", "-h")) {
    console.log(`
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
`);
    return;
  }

  const scanPaths = getScanPaths(ctx);
  const results = scanDirectory(ctx.projectRoot, scanPaths);
  const data = analyze(results);

  if (hasFlag(args, "--json")) {
    console.log(
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
  console.log(`Frontend usage report written to ${outputPath}`);
  console.log(
    `  ${Object.keys(data.components).length} components use ${tableCount} tables, ${rpcCount} RPCs, ${fnCount} edge functions`,
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
  version: "1.0.0",

  commands: [
    {
      name: "frontend-usage",
      description: "Scan frontend code for Supabase SDK usage, generate HTML report",
      run: frontendUsageCommand,
    },
  ],

  getAtlasData: async (ctx: PluginContext) => {
    const scanPaths = getScanPaths(ctx);
    const results = scanDirectory(ctx.projectRoot, scanPaths);
    const data = analyze(results);
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

  getAtlasUI: () => ({
    kindLabels: { frontend_usage: "Frontend Usage" },
    sectionHtml: frontendUsageSectionHtml(),
    cardRendererJs: frontendUsageCardRendererJs(),
    initJs: `
      (function() {
        var summary = document.getElementById("frontend-usage-summary");
        if (summary && data.categories.frontend_usage) {
          var items = data.categories.frontend_usage;
          var comps = items.length;
          var tables = 0, rpcs = 0;
          var seenT = {}, seenR = {};
          items.forEach(function(it) {
            (it.resources || []).forEach(function(r) {
              if (r.type === "table" && !seenT[r.resource]) { seenT[r.resource]=1; tables++; }
              if (r.type === "rpc" && !seenR[r.resource]) { seenR[r.resource]=1; rpcs++; }
            });
          });
          summary.innerHTML = '<div class="fw-stat"><span class="fw-stat-value">' + comps + '</span><span class="fw-stat-label">components</span></div>' +
            '<div class="fw-stat"><span class="fw-stat-value">' + tables + '</span><span class="fw-stat-label">tables</span></div>' +
            '<div class="fw-stat"><span class="fw-stat-value">' + rpcs + '</span><span class="fw-stat-label">RPCs</span></div>';
        }
        renderSection("frontend-usage-list", data.categories.frontend_usage || [], renderFrontendUsageCard, "components");
      })();
    `,
    styles: frontendUsageStyles(),
  }),

  getStatusLines: async (ctx: PluginContext) => {
    const scanPaths = getScanPaths(ctx);
    const results = scanDirectory(ctx.projectRoot, scanPaths);
    const data = analyze(results);
    const compCount = Object.keys(data.components).length;
    const tableCount = data.byResource.table?.length ?? 0;
    const rpcCount = data.byResource.rpc?.length ?? 0;
    return [
      `  Frontend: ${compCount} components use ${tableCount} tables, ${rpcCount} RPCs`,
    ];
  },
};

export default plugin;