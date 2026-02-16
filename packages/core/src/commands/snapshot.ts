import path from "node:path";
import { Client } from "pg";
import "dotenv/config";
import { ui, DatabaseError, ensureDir, writeFileInDir, resolveDbUrl } from "@sbtools/sdk";
import type { SnapshotMeta, SnapshotContext } from "@sbtools/sdk";
import { config, resolve } from "../config.js";
import { clearDir, sanitizeDbUrl, parseSchemaArgs, getSchemaFilter } from "../utils/index.js";
import { formatReadme } from "../generators/index.js";
import {
  extractFunctions,
  extractViews,
  extractMaterializedViews,
  extractTriggers,
  extractPolicies,
  extractTypes,
  extractEnums,
} from "../extractors/index.js";

type ExtractorFn = (client: Client, ctx: SnapshotContext) => Promise<void>;

const EXTRACTORS: Array<{
  label: string;
  countKey: keyof SnapshotMeta["object_counts"];
  extract: ExtractorFn;
}> = [
  { label: "📦 Extracting functions...", countKey: "functions", extract: extractFunctions },
  { label: "👁️  Extracting views...", countKey: "views", extract: extractViews },
  { label: "📊 Extracting materialized views...", countKey: "materialized_views", extract: extractMaterializedViews },
  { label: "⚡ Extracting triggers...", countKey: "triggers", extract: extractTriggers },
  { label: "🔒 Extracting RLS policies...", countKey: "policies", extract: extractPolicies },
  { label: "📋 Extracting custom types...", countKey: "types", extract: extractTypes },
  { label: "🔢 Extracting enums...", countKey: "enums", extract: extractEnums },
];

async function withDbClient<T>(dbUrl: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.end().catch((err) => {
      if (process.env.SBT_DEBUG === "1") ui.warn(`client.end() failed: ${(err as Error).message}`);
    });
  }
}

export async function runSnapshot(): Promise<void> {
  const OUT_DIR = resolve(config.paths.snapshot);
  const requestedSchemas = parseSchemaArgs(process.argv.slice(3));
  const isAllSchemas = requestedSchemas === null;
  const schemas = requestedSchemas ?? [];

  ui.step("📸 Generating database snapshot...\n");
  if (isAllSchemas) {
    ui.info("📋 Including all schemas\n");
  } else {
    ui.info(`📋 Including schemas: ${schemas.join(", ")}\n`);
  }

  ui.step("🧹 Clearing previous snapshot...");
  for (const dir of ["functions", "views", "triggers", "policies", "types", "enums"]) {
    clearDir(path.join(OUT_DIR, dir));
  }
  ensureDir(path.join(OUT_DIR, "_meta"));
  ui.success("✅ Cleared previous snapshot\n");

  const dbUrl = resolveDbUrl();
  const schemaFilterNsp = getSchemaFilter(requestedSchemas, "nspname");
  const schemaFilterSchemaname = getSchemaFilter(requestedSchemas, "schemaname");

  try {
    const metadata = await withDbClient(dbUrl, async (client) => {
      ui.step("🔗 Connecting to database...");
      ui.success("✅ Connected successfully\n");

      const versionResult = await client.query("SELECT version()");
      const postgresVersion = versionResult.rows[0]?.version ?? "unknown";

      const meta: SnapshotMeta = {
        timestamp: new Date().toISOString(),
        database_url: sanitizeDbUrl(dbUrl),
        postgres_version: postgresVersion,
        object_counts: {
          functions: 0,
          views: 0,
          materialized_views: 0,
          triggers: 0,
          policies: 0,
          types: 0,
          enums: 0,
        },
      };

      const ctx: SnapshotContext = {
        outDir: OUT_DIR,
        schemaFilterNsp,
        schemaFilterSchemaname,
        meta,
      };

      for (const { label, countKey, extract } of EXTRACTORS) {
        ui.step(label);
        await extract(client, ctx);
        ui.detail(`   ✓ Extracted ${meta.object_counts[countKey]} ${String(countKey).replace("_", " ")}`);
      }

      writeFileInDir(OUT_DIR, "_meta/snapshot.json", JSON.stringify(meta, null, 2) + "\n");
      writeFileInDir(OUT_DIR, "_meta/README.md", formatReadme(meta));
      return meta;
    });

    ui.success("\n✅ Snapshot generated successfully!");
    ui.info(`📁 Location: ${OUT_DIR}`);
    ui.heading("\n📊 Summary:");
    ui.detail(`   Functions: ${metadata.object_counts.functions}`);
    ui.detail(`   Views: ${metadata.object_counts.views}`);
    ui.detail(`   Materialized Views: ${metadata.object_counts.materialized_views}`);
    ui.detail(`   Triggers: ${metadata.object_counts.triggers}`);
    ui.detail(`   Policies: ${metadata.object_counts.policies}`);
    ui.detail(`   Types: ${metadata.object_counts.types}`);
    ui.detail(`   Enums: ${metadata.object_counts.enums}`);
  } catch (error) {
    throw new DatabaseError(
      `Error generating snapshot: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
