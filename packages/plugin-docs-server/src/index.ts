import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ui, SbtError, extractComposeKey } from "@sbtools/sdk";
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-docs-server",
  version: "1.0.0",

  commands: [
    {
      name: "start-docs-server",
      description: "Start API documentation services (Swagger UI, ReDoc, Backend Atlas)",
      async run(args: string[], ctx: PluginContext): Promise<void> {
        const composePath = path.join(ctx.toolsDir, "docker-compose.api-docs.yml");
        const dbComposePath = path.join(ctx.toolsDir, "docker-compose.db.yml");
        const specPath = path.join(ctx.sbtDataDir, "openapi-spec.json");
        const envFile = path.join(ctx.sbtDataDir, ".env");

        // Handle stop command
        if (args.includes("stop")) {
          ui.step("Stopping documentation services...");
          execSync(`docker compose -f "${composePath}" --env-file "${envFile}" down`, {
            stdio: "inherit",
            cwd: ctx.toolsDir,
          });
          ui.success("Documentation services stopped.");
          return;
        }

        ui.heading("\nStarting API documentation services...\n");

        // Fetch OpenAPI spec
        ui.step("Fetching OpenAPI spec from REST API...\n");

        const serviceKey = extractComposeKey(dbComposePath, [
          /SUPABASE_SERVICE_ROLE_KEY:\s*([^\s]+)/,
          /SUPABASE_SERVICE_KEY:\s*([^\s]+)/,
          /SERVICE_KEY:\s*([^\s]+)/,
        ]);
        const anonKey = extractComposeKey(dbComposePath, [
          /SUPABASE_ANON_KEY:\s*([^\s]+)/,
          /ANON_KEY:\s*([^\s]+)/,
        ]);
        const key = serviceKey || anonKey;

        let fetched = false;
        if (key) {
          try {
            const res = await fetch(`${ctx.apiUrl}/rest/v1/`, {
              headers: { apikey: key, Authorization: `Bearer ${key}` },
            });
            if (res.ok) {
              const spec = await res.json();
              const pathCount = Object.keys(spec.paths || {}).length;
              writeFileSync(specPath, JSON.stringify(spec, null, 2), "utf8");
              ui.success(`OpenAPI spec fetched (${pathCount} endpoints).\n`);
              fetched = true;
            } else {
              ui.warn(`Failed to fetch OpenAPI spec: ${res.status} ${res.statusText}`);
            }
          } catch {
            ui.warn("Could not reach REST API to fetch OpenAPI spec (is the DB running?)");
          }
        } else {
          ui.warn("Could not find API key in docker-compose.db.yml");
        }

        if (!fetched) {
          if (!existsSync(specPath)) {
            const placeholder = {
              openapi: "3.0.0",
              info: { title: "Supabase REST API", description: "Run 'sbt start' then 'sbt docs' to generate the full spec.", version: "0.0.0" },
              paths: {},
            };
            writeFileSync(specPath, JSON.stringify(placeholder, null, 2), "utf8");
          }
          ui.detail("   Using placeholder spec. Re-run 'docs' with DB running for full spec.\n");
        }

        // Merge plugin OpenAPI specs from siblings
        const siblingPlugins = ctx.siblingPlugins ?? [];
        const pluginsWithSpec = siblingPlugins.filter((p) => p.getOpenApiSpec);

        if (pluginsWithSpec.length > 0) {
          ui.step("Merging plugin OpenAPI specs...\n");

          const spec = JSON.parse(readFileSync(specPath, "utf8")) as Record<string, unknown>;
          const specPaths = (spec.paths ?? {}) as Record<string, unknown>;
          const specComponents = (spec.components ?? {}) as Record<string, Record<string, unknown>>;
          const specTags = (spec.tags ?? []) as { name: string; description?: string }[];

          for (const sibling of pluginsWithSpec) {
            try {
              const pluginSpec = await sibling.getOpenApiSpec!(ctx);
              const pPaths = (pluginSpec.paths ?? {}) as Record<string, unknown>;
              Object.assign(specPaths, pPaths);

              const pComponents = (pluginSpec.components ?? {}) as Record<string, Record<string, unknown>>;
              for (const [section, entries] of Object.entries(pComponents)) {
                if (!specComponents[section]) specComponents[section] = {};
                Object.assign(specComponents[section], entries);
              }

              const pTags = (pluginSpec.tags ?? []) as { name: string; description?: string }[];
              for (const tag of pTags) {
                if (!specTags.some((t) => t.name === tag.name)) specTags.push(tag);
              }

              ui.detail(`   ${sibling.name}: ${Object.keys(pPaths).length} path(s) merged.`);
            } catch (err) {
              ui.warn(`   ${sibling.name} getOpenApiSpec failed: ${(err as Error).message}`);
            }
          }

          spec.paths = specPaths;
          spec.components = specComponents;
          if (specTags.length > 0) spec.tags = specTags;

          writeFileSync(specPath, JSON.stringify(spec, null, 2), "utf8");
          ui.info(`\n   Combined spec: ${Object.keys(specPaths).length} total paths.\n`);
        }

        try {
          ui.step("Starting Docker containers...\n");
          execSync(`docker compose -f "${composePath}" --env-file "${envFile}" up -d --force-recreate`, {
            stdio: "inherit",
            cwd: ctx.toolsDir,
          });

          ui.info("\nWaiting for services to start...\n");
          await new Promise((r) => setTimeout(r, 2000));

          ui.success("\nAPI Documentation Services Started!\n");
          ui.separator();
          ui.heading("\nAvailable Documentation:\n");
          ui.table([
            ["Swagger UI",    "http://localhost:8081"],
            ["ReDoc",         "http://localhost:8082"],
            ["Backend Atlas", "http://localhost:8083/atlas/"],
            ["SchemaSpy",     "http://localhost:8083/schemaspy/"],
          ], 2);
          ui.blank();
          ui.separator();
          ui.info(`\nTo stop: sbt docs stop\n`);
        } catch (error) {
          throw new SbtError(
            "COMMAND_FAILED",
            `Error starting API documentation services: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error, tips: ["Ensure Docker is running: start Docker Desktop"] },
          );
        }
      },
    },
  ],
};

export default plugin;
