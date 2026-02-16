/**
 * @sbtools/plugin-deno-functions
 *
 * Plugin for supabase-tools that documents Supabase Edge Functions
 * by statically analysing TypeScript source files in the functions directory.
 *
 * Activated by adding an entry in supabase-tools.config.json:
 *
 *   "plugins": [{
 *     "path": "node_modules/@sbtools/plugin-deno-functions",
 *     "config": {
 *       "baseUrl": "/functions/v1",
 *       "configTomlPath": "supabase/config.toml"
 *     }
 *   }]
 */
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";
import { extractEdgeFunctions } from "./extractor.js";
import { writeOpenApiPartialArtifact } from "./artifact.js";
import { edgeFunctionSectionHtml } from "./atlas/sections.js";
import { edgeFunctionCardRendererJs } from "./atlas/cards.js";
import { edgeFunctionStyles } from "./atlas/styles.js";
import { generateEdgeFunctionOpenApi } from "./openapi.js";

const require = createRequire(import.meta.url);
const PLUGIN_VERSION: string = (require("../package.json") as { version: string }).version;

function resolveConfigTomlPath(ctx: PluginContext): string | undefined {
  const tomlRel = (ctx.pluginConfig.configTomlPath as string) ?? "supabase/config.toml";
  const tomlPath = path.resolve(ctx.projectRoot, tomlRel);
  return fs.existsSync(tomlPath) ? tomlPath : undefined;
}

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-deno-functions",
  version: PLUGIN_VERSION,
  artifactCapabilities: {
    produces: ["openapi.partial.deno-functions"],
    consumes: [],
  },

  commands: [
    {
      name: "edge-functions",
      description: "List discovered edge functions and their metadata",
      run: async (args: string[], ctx: PluginContext): Promise<void> => {
        // ---- Help ----
        if (args.includes("--help") || args.includes("-h")) {
          console.log(`
edge-functions — Discover and document Supabase Edge Functions

Usage:
  sbt edge-functions [options]

Options:
  --help, -h      Show this help message
  --openapi       Generate an OpenAPI 3.0 spec at docs/edge-functions-openapi.json
  --json          Output raw JSON instead of the formatted table
  --brief         Show only the summary table, skip per-function details

How it works:
  Scans the functions directory (configured via paths.functions) for
  subdirectories containing an index.ts. Each file is statically analysed
  to extract HTTP methods, request/response fields, environment variables,
  auth requirements, external API calls, and database table references.

  Auth settings (verify_jwt) are read from supabase/config.toml.

  You can override or supplement extracted data by placing a metadata.json
  next to index.ts in any function directory.

Plugin config (in supabase-tools.config.json → plugins[].config):
  baseUrl          URL prefix for endpoints (default: "/functions/v1")
  configTomlPath   Path to config.toml (default: "supabase/config.toml")
`);
          return;
        }

        const baseUrl = (ctx.pluginConfig.baseUrl as string) ?? "/functions/v1";
        const items = extractEdgeFunctions({
          functionsPath: ctx.paths.functions,
          configTomlPath: resolveConfigTomlPath(ctx),
          baseUrl,
        });
        if (items.length > 0) {
          writeOpenApiPartialArtifact(ctx, items, { baseUrl, pluginVersion: PLUGIN_VERSION });
        }

        if (items.length === 0) {
          console.log("No edge functions found.");
          return;
        }

        // ---- JSON mode ----
        if (args.includes("--json")) {
          console.log(JSON.stringify(items, null, 2));
          return;
        }

        console.log(`\nDiscovered ${items.length} edge function(s):\n`);
        console.log(
          "  " +
            "Name".padEnd(26) +
            "Methods".padEnd(14) +
            "Auth".padEnd(16) +
            "Endpoint"
        );
        console.log("  " + "-".repeat(80));

        for (const fn of items) {
          const methods = fn.methods.filter((m) => m !== "OPTIONS").join(", ");
          console.log(
            "  " +
              fn.name.padEnd(26) +
              methods.padEnd(14) +
              fn.auth_type.padEnd(16) +
              fn.endpoint
          );
        }

        // Show details for each (unless --brief)
        if (!args.includes("--brief")) {
          for (const fn of items) {
            console.log(`\n--- ${fn.name} ---`);
            if (fn.request_fields.length) {
              console.log("  Request fields:");
              for (const f of fn.request_fields) {
                console.log(`    ${f.name}: ${f.type}`);
              }
            }
            if (fn.response_fields.length) {
              console.log("  Response fields:");
              for (const f of fn.response_fields) {
                console.log(`    ${f.name}: ${f.type}`);
              }
            }
            if (fn.env_vars.length) {
              console.log(`  Env vars: ${fn.env_vars.join(", ")}`);
            }
            if (fn.external_apis.length) {
              console.log(`  External APIs: ${fn.external_apis.join(", ")}`);
            }
            if (fn.db_tables.length) {
              console.log(`  DB tables: ${fn.db_tables.join(", ")}`);
            }
            if (fn.storage_buckets.length) {
              console.log(`  Storage buckets: ${fn.storage_buckets.join(", ")}`);
            }
          }
        }

        // Generate OpenAPI spec if --openapi flag is passed
        if (args.includes("--openapi")) {
          const spec = generateEdgeFunctionOpenApi(items, {
            apiUrl: ctx.apiUrl,
            baseUrl,
          });
          const outPath = path.join(ctx.paths.docsOutput, "edge-functions-openapi.json");
          fs.mkdirSync(path.dirname(outPath), { recursive: true });
          fs.writeFileSync(outPath, JSON.stringify(spec, null, 2) + "\n", "utf8");
          console.log(`\nOpenAPI spec written to: ${outPath}`);
        }

        console.log("");
      },
    },
  ],

  getAtlasData: async (ctx: PluginContext) => {
    const baseUrl = (ctx.pluginConfig.baseUrl as string) ?? "/functions/v1";
    const items = extractEdgeFunctions({
      functionsPath: ctx.paths.functions,
      configTomlPath: resolveConfigTomlPath(ctx),
      baseUrl,
    });
    if (items.length > 0) {
      writeOpenApiPartialArtifact(ctx, items, { baseUrl, pluginVersion: PLUGIN_VERSION });
    }

    return {
      categories: { edge_functions: items },
      stats: [{ label: "Edge Functions", value: items.length }],
    };
  },

  getAtlasUI: () => ({
    kindLabels: { edge_function: "Edge Functions" },
    sectionHtml: edgeFunctionSectionHtml(),
    cardRendererJs: edgeFunctionCardRendererJs(),
    initJs: `renderSection("edge-functions-list", data.categories.edge_functions || [], renderEdgeFunctionCard, "edge functions");`,
    styles: edgeFunctionStyles(),
  }),

  getOpenApiSpec: async (ctx: PluginContext) => {
    const baseUrl = (ctx.pluginConfig.baseUrl as string) ?? "/functions/v1";
    const items = extractEdgeFunctions({
      functionsPath: ctx.paths.functions,
      configTomlPath: resolveConfigTomlPath(ctx),
      baseUrl,
    });
    return generateEdgeFunctionOpenApi(items, { apiUrl: ctx.apiUrl, baseUrl }) as unknown as Record<string, unknown>;
  },

  getStatusLines: async (ctx: PluginContext) => {
    const baseUrl = (ctx.pluginConfig.baseUrl as string) ?? "/functions/v1";
    const items = extractEdgeFunctions({
      functionsPath: ctx.paths.functions,
      configTomlPath: resolveConfigTomlPath(ctx),
      baseUrl,
    });
    if (items.length === 0) {
      return ["  (no edge functions found)"];
    }

    const lines: string[] = [];
    for (const fn of items) {
      const methods = fn.methods.filter((m) => m !== "OPTIONS").join(",");
      const auth = fn.verify_jwt ? "JWT" : fn.auth_type === "service_role" ? "SvcRole" : "public";
      lines.push(
        `  ${fn.name.padEnd(24)} ${methods.padEnd(8)} ${auth.padEnd(10)} ${ctx.apiUrl}${fn.endpoint}`
      );
    }
    return lines;
  },
};

export default plugin;
