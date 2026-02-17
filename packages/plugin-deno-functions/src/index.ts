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
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";
import { loadPackageVersion, resolveConfigPath, getConfigString, ui, withHelp } from "@sbtools/sdk";
import { extractEdgeFunctions } from "./extractor.js";
import { writeOpenApiPartialArtifact } from "./artifact.js";
import { getEdgeFunctionDashboardView } from "./dashboard.js";
import { generateEdgeFunctionOpenApi } from "./openapi.js";

const PLUGIN_VERSION = loadPackageVersion(import.meta.url);

function resolveConfigTomlPath(ctx: PluginContext): string | undefined {
  const tomlPath = resolveConfigPath(ctx, "configTomlPath", "supabase/config.toml");
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
      run: withHelp(
        `
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
`,
        async (args: string[], ctx: PluginContext): Promise<void> => {
          const baseUrl = getConfigString(ctx, "baseUrl", "/functions/v1");
        const items = extractEdgeFunctions({
          functionsPath: ctx.paths.functions,
          configTomlPath: resolveConfigTomlPath(ctx),
          baseUrl,
        });
        if (items.length > 0) {
          writeOpenApiPartialArtifact(ctx, items, { baseUrl, pluginVersion: PLUGIN_VERSION });
        }

        if (items.length === 0) {
          ui.info("No edge functions found.");
          return;
        }

        // ---- JSON mode ----
        if (args.includes("--json")) {
          ui.log(JSON.stringify(items, null, 2));
          return;
        }

        ui.log(`\nDiscovered ${items.length} edge function(s):\n`);
        ui.detail(
          "  " +
            "Name".padEnd(26) +
            "Methods".padEnd(14) +
            "Auth".padEnd(16) +
            "Endpoint"
        );
        ui.detail("  " + "-".repeat(80));

        for (const fn of items) {
          const methods = fn.methods.filter((m) => m !== "OPTIONS").join(", ");
          ui.detail(
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
            ui.detail(`\n--- ${fn.name} ---`);
            if (fn.request_fields.length) {
              ui.detail("  Request fields:");
              for (const f of fn.request_fields) {
                ui.detail(`    ${f.name}: ${f.type}`);
              }
            }
            if (fn.response_fields.length) {
              ui.detail("  Response fields:");
              for (const f of fn.response_fields) {
                ui.detail(`    ${f.name}: ${f.type}`);
              }
            }
            if (fn.env_vars.length) {
              ui.detail(`  Env vars: ${fn.env_vars.join(", ")}`);
            }
            if (fn.external_apis.length) {
              ui.detail(`  External APIs: ${fn.external_apis.join(", ")}`);
            }
            if (fn.db_tables.length) {
              ui.detail(`  DB tables: ${fn.db_tables.join(", ")}`);
            }
            if (fn.storage_buckets.length) {
              ui.detail(`  Storage buckets: ${fn.storage_buckets.join(", ")}`);
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
          ui.info(`\nOpenAPI spec written to: ${outPath}`);
        }

        ui.blank();
        },
      ),
    },
  ],

  getAtlasData: async (ctx: PluginContext) => {
    const baseUrl = getConfigString(ctx, "baseUrl", "/functions/v1");
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

  getDashboardView: () => getEdgeFunctionDashboardView(),

  getOpenApiSpec: async (ctx: PluginContext) => {
    const baseUrl = getConfigString(ctx, "baseUrl", "/functions/v1");
    const items = extractEdgeFunctions({
      functionsPath: ctx.paths.functions,
      configTomlPath: resolveConfigTomlPath(ctx),
      baseUrl,
    });
    return generateEdgeFunctionOpenApi(items, { apiUrl: ctx.apiUrl, baseUrl }) as unknown as Record<string, unknown>;
  },

  getStatusLines: async (ctx: PluginContext) => {
    const baseUrl = getConfigString(ctx, "baseUrl", "/functions/v1");
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
