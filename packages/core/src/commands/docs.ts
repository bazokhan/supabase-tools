/**
 * docs command — Start API documentation services (Swagger, ReDoc, SchemaSpy).
 * Moved from plugin-docs-server into core.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  ui,
  SbtError,
  extractSupabaseKeys,
  readArtifact,
  COMPOSE_API_DOCS_FILE,
  COMPOSE_DB_FILE,
  withHelp,
} from "@sbtools/sdk";
import type { PluginContext } from "@sbtools/sdk";
import { config, resolve } from "../config.js";

/** OpenAPI partial artifacts: id → version, in merge order. Skip plugin when artifact used. */
const OPENAPI_PARTIAL_ARTIFACTS: Array<{ id: string; version: string; skipPlugin: string }> = [
  { id: "openapi.partial.deno-functions", version: "1.0.0", skipPlugin: "@sbtools/plugin-deno-functions" },
];

type DocsSubcommand = "swagger" | "redoc" | "schemaspy" | "all" | "stop";

const VALID_SUBCOMMANDS = new Set<string>(["swagger", "redoc", "schemaspy", "all", "stop"]);

const SERVICE_MAP: Record<string, string[]> = {
  swagger: ["swagger-ui"],
  redoc: ["redoc"],
  schemaspy: ["schemaspy", "docs-server"],
  all: [],
};

const SERVICE_URLS: Record<string, [string, string]> = {
  swagger: ["Swagger UI", "http://localhost:8081"],
  redoc: ["ReDoc", "http://localhost:8082"],
  schemaspy: ["SchemaSpy", "http://localhost:8083/schemaspy/"],
};

function preflightOpenApi(ctx: PluginContext, specPath: string, dbComposePath: string): void {
  const composePath = path.join(ctx.toolsDir, COMPOSE_API_DOCS_FILE);
  if (!existsSync(composePath)) {
    throw new SbtError("PREFLIGHT_FAILED", `${COMPOSE_API_DOCS_FILE} not found.`, {
      tips: ["This file ships with supabase-tools. Re-clone or restore it."],
    });
  }
  if (!existsSync(path.join(ctx.sbtDataDir, ".env"))) {
    throw new SbtError("PREFLIGHT_FAILED", ".env file not found in .sbt/.", {
      tips: ["Run `sbt init` to create project directories and env file."],
    });
  }
}

async function ensureOpenApiSpec(
  ctx: PluginContext,
  specPath: string,
  dbComposePath: string,
): Promise<void> {
  ui.step("Preparing OpenAPI spec...\n");

  const { anonKey, serviceKey } = extractSupabaseKeys(dbComposePath);
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
        info: {
          title: "Supabase REST API",
          description: "Run 'sbt start' then 'sbt docs swagger' to generate the full spec.",
          version: "0.0.0",
        },
        paths: {},
      };
      writeFileSync(specPath, JSON.stringify(placeholder, null, 2), "utf8");
    }
    ui.detail("   Using existing/placeholder spec. Re-run with DB running for full spec.\n");
  }

  const siblingPlugins = ctx.siblingPlugins ?? [];
  const pluginsWithSpec = siblingPlugins.filter((p) => p.getOpenApiSpec);
  const skippedFromArtifact = new Set<string>();

  const spec = JSON.parse(readFileSync(specPath, "utf8")) as Record<string, unknown>;
  const specPaths = (spec.paths ?? {}) as Record<string, unknown>;
  const specComponents = (spec.components ?? {}) as Record<string, Record<string, unknown>>;
  const specTags = (spec.tags ?? []) as { name: string; description?: string }[];

  const hasAnyPluginSource = pluginsWithSpec.length > 0 || OPENAPI_PARTIAL_ARTIFACTS.length > 0;
  if (hasAnyPluginSource) {
    ui.step("Merging plugin OpenAPI specs...\n");
  }

  for (const { id, version, skipPlugin } of OPENAPI_PARTIAL_ARTIFACTS) {
    const result = readArtifact<{
      paths?: Record<string, unknown>;
      components?: Record<string, Record<string, unknown>>;
      tags?: Array<{ name: string; description?: string }>;
    }>(ctx, id, version);
    if (result.ok) {
      const pPaths = (result.envelope.data.paths ?? {}) as Record<string, unknown>;
      Object.assign(specPaths, pPaths);
      const pComponents = result.envelope.data.components ?? {};
      for (const [section, entries] of Object.entries(pComponents)) {
        if (!specComponents[section]) specComponents[section] = {};
        Object.assign(specComponents[section], entries);
      }
      const pTags = result.envelope.data.tags ?? [];
      for (const tag of pTags) {
        if (!specTags.some((t) => t.name === tag.name)) specTags.push(tag);
      }
      ui.detail(`   ${id} (artifact): ${Object.keys(pPaths).length} path(s) merged.`);
      skippedFromArtifact.add(skipPlugin);
    }
  }

  for (const sibling of pluginsWithSpec) {
    if (skippedFromArtifact.has(sibling.name)) continue;
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

  if (hasAnyPluginSource) {
    spec.paths = specPaths;
    spec.components = specComponents;
    if (specTags.length > 0) spec.tags = specTags;
    writeFileSync(specPath, JSON.stringify(spec, null, 2), "utf8");
    ui.info(`\n   Combined spec: ${Object.keys(specPaths).length} total paths.\n`);
  }
}

function composeUp(
  composePath: string,
  envFile: string,
  toolsDir: string,
  services: string[],
): void {
  const serviceArgs = services.length > 0 ? ` ${services.join(" ")}` : "";
  execSync(
    `docker compose -f "${composePath}" --env-file "${envFile}" up -d --force-recreate${serviceArgs}`,
    { stdio: "inherit", cwd: toolsDir },
  );
}

function composeDown(composePath: string, envFile: string, toolsDir: string): void {
  execSync(
    `docker compose -f "${composePath}" --env-file "${envFile}" down`,
    { stdio: "inherit", cwd: toolsDir },
  );
}

const DOCS_HELP = `
docs — Start API documentation services

Usage:
  sbt docs [subcommand] [stop]

Subcommands:
  swagger    Swagger UI only (port 8081). Needs openapi-spec.
  redoc      ReDoc only (port 8082). Needs openapi-spec.
  schemaspy  SchemaSpy only (port 8083/schemaspy/). Needs DB running.
  all        All services (default if no subcommand).
  stop       Stop all docs containers.

Options:
  -h, --help  Show this help
`;

export async function runDocs(args: string[], ctx: PluginContext): Promise<void> {
  const composePath = path.join(ctx.toolsDir, COMPOSE_API_DOCS_FILE);
  const dbComposePath = path.join(ctx.toolsDir, COMPOSE_DB_FILE);
  const specPath = path.join(ctx.sbtDataDir, "openapi-spec.json");
  const envFile = path.join(ctx.sbtDataDir, ".env");

  const sub = args.find((a) => !a.startsWith("-")) as DocsSubcommand | undefined;
  const subcommand: DocsSubcommand =
    sub && VALID_SUBCOMMANDS.has(sub) ? (sub as DocsSubcommand) : "all";

  if (subcommand === "stop" || args.includes("stop")) {
    ui.step("Stopping documentation services...");
    try {
      composeDown(composePath, envFile, ctx.toolsDir);
    } catch {
      /* containers may not be running */
    }
    ui.success("Documentation services stopped.");
    return;
  }

  const needsOpenApi = subcommand === "swagger" || subcommand === "redoc" || subcommand === "all";

  preflightOpenApi(ctx, specPath, dbComposePath);

  if (needsOpenApi) {
    await ensureOpenApiSpec(ctx, specPath, dbComposePath);
  }

  const services = SERVICE_MAP[subcommand] ?? [];
  ui.heading(`\nStarting docs services (${subcommand})...\n`);

  try {
    composeUp(composePath, envFile, ctx.toolsDir, services);

    ui.info("\nWaiting for services to start...\n");
    await new Promise((r) => setTimeout(r, 2000));

    ui.success("\nDocumentation Services Started!\n");
    ui.separator();
    ui.heading("\nAvailable:\n");

    const urlsToShow =
      subcommand === "all"
        ? Object.values(SERVICE_URLS)
        : subcommand === "schemaspy"
          ? [SERVICE_URLS.schemaspy]
          : [SERVICE_URLS[subcommand]];

    ui.table(urlsToShow, 2);
    ui.blank();
    ui.separator();
    ui.info(`\nTo stop: sbt docs stop\n`);
  } catch (error) {
    throw new SbtError(
      "COMMAND_FAILED",
      `Error starting documentation services: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error, tips: ["Ensure Docker is running: start Docker Desktop"] },
    );
  }
}

export const docsCommand = withHelp(DOCS_HELP, runDocs);
