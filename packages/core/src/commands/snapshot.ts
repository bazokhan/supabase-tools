import path from "node:path";
import { Client } from "pg";
import "dotenv/config";
import { ui, DatabaseError, ensureDir, writeFileInDir } from "@sbtools/sdk";
import type { SnapshotMeta, SnapshotContext } from "@sbtools/sdk";
import { config, resolve, getDbUrl } from "../config.js";
import { clearDir, sanitizeDbUrl, parseSchemaArgs, getSchemaFilter } from "../utils/index.js";
import { formatReadme } from "../generators/index.js";
import {
  extractFunctions, extractViews, extractMaterializedViews,
  extractTriggers, extractPolicies, extractTypes, extractEnums,
} from "../extractors/index.js";

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

  const dbUrl = getDbUrl();
  const sanitizedUrl = sanitizeDbUrl(dbUrl);
  ui.step("🔗 Connecting to database...");
  const client = new Client({ connectionString: dbUrl });
  const schemaFilterNsp = getSchemaFilter(requestedSchemas, "nspname");
  const schemaFilterSchemaname = getSchemaFilter(requestedSchemas, "schemaname");

  try {
    await client.connect();
    ui.success("✅ Connected successfully\n");

    const versionResult = await client.query("SELECT version()");
    const postgresVersion = versionResult.rows[0]?.version ?? "unknown";

    const metadata: SnapshotMeta = {
      timestamp: new Date().toISOString(),
      database_url: sanitizedUrl,
      postgres_version: postgresVersion,
      object_counts: {
        functions: 0, views: 0, materialized_views: 0,
        triggers: 0, policies: 0, types: 0, enums: 0,
      },
    };

    const ctx: SnapshotContext = { outDir: OUT_DIR, schemaFilterNsp, schemaFilterSchemaname, meta: metadata };

    ui.step("📦 Extracting functions...");
    await extractFunctions(client, ctx);
    ui.detail(`   ✓ Extracted ${metadata.object_counts.functions} functions`);

    ui.step("👁️  Extracting views...");
    await extractViews(client, ctx);
    ui.detail(`   ✓ Extracted ${metadata.object_counts.views} views`);

    ui.step("📊 Extracting materialized views...");
    await extractMaterializedViews(client, ctx);
    ui.detail(`   ✓ Extracted ${metadata.object_counts.materialized_views} materialized views`);

    ui.step("⚡ Extracting triggers...");
    await extractTriggers(client, ctx);
    ui.detail(`   ✓ Extracted ${metadata.object_counts.triggers} triggers`);

    ui.step("🔒 Extracting RLS policies...");
    await extractPolicies(client, ctx);
    ui.detail(`   ✓ Extracted ${metadata.object_counts.policies} policies`);

    ui.step("📋 Extracting custom types...");
    await extractTypes(client, ctx);
    ui.detail(`   ✓ Extracted ${metadata.object_counts.types} custom types`);

    ui.step("🔢 Extracting enums...");
    await extractEnums(client, ctx);
    ui.detail(`   ✓ Extracted ${metadata.object_counts.enums} enums`);

    writeFileInDir(OUT_DIR, "_meta/snapshot.json", JSON.stringify(metadata, null, 2) + "\n");
    writeFileInDir(OUT_DIR, "_meta/README.md", formatReadme(metadata));
    await client.end();

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
    await client.end().catch(() => {});
    throw new DatabaseError(
      `Error generating snapshot: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
