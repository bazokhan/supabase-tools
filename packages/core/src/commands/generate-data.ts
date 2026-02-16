import fs from "node:fs";
import path from "node:path";
import { ui, SnapshotError, ensureDir, readText } from "@sbtools/sdk";
import type { AtlasData, SnapshotMeta } from "@sbtools/sdk";
import { config, resolve } from "../config.js";
import {
  buildFunctions,
  buildViews,
  buildTriggers,
  buildPolicies,
  buildTypes,
  buildEnums,
} from "../parsers/atlas-builders.js";
import { loadPlugins, buildPluginContext } from "../plugin-loader.js";

/**
 * Build AtlasData from a snapshot directory. Exported for testing.
 */
export function buildAtlasDataFromDir(SNAPSHOT_DIR: string): AtlasData {
  const metaPath = path.join(SNAPSHOT_DIR, "_meta", "snapshot.json");
  if (!fs.existsSync(metaPath)) {
    throw new SnapshotError(`Snapshot metadata not found at ${metaPath}.`);
  }

  const meta = JSON.parse(readText(metaPath)) as SnapshotMeta;

  const functions = buildFunctions(SNAPSHOT_DIR);
  const { views, materializedViews } = buildViews(SNAPSHOT_DIR);
  const triggers = buildTriggers(SNAPSHOT_DIR);
  const policies = buildPolicies(SNAPSHOT_DIR);
  const types = buildTypes(SNAPSHOT_DIR);
  const enums = buildEnums(SNAPSHOT_DIR);

  const schemas = new Set<string>();
  [...functions, ...views, ...materializedViews, ...triggers, ...policies, ...types, ...enums].forEach(
    (item) => {
      if (item.schema) schemas.add(item.schema);
    }
  );

  return {
    meta: { ...meta, generated_at: new Date().toISOString() },
    schemas: Array.from(schemas).sort(),
    categories: {
      functions,
      views,
      materialized_views: materializedViews,
      triggers,
      policies,
      types,
      enums,
    },
  };
}

function buildAtlasData(): AtlasData {
  const SNAPSHOT_DIR = resolve(config.paths.snapshot);
  return buildAtlasDataFromDir(SNAPSHOT_DIR);
}

export async function runGenerateData(): Promise<void> {
  const OUT_DIR = resolve(config.paths.docsOutput);
  const OUT_FILE = path.join(OUT_DIR, "backend-atlas-data.json");
  ensureDir(OUT_DIR);

  const data = buildAtlasData();

  // --- Plugin contributions ---
  const loaded = await loadPlugins();
  for (const entry of loaded) {
    if (entry.plugin.getAtlasData) {
      try {
        const ctx = buildPluginContext(entry);
        const contribution = await entry.plugin.getAtlasData(ctx);
        for (const [key, items] of Object.entries(contribution.categories)) {
          if (key in data.categories) {
            ui.warn(`⚠️  Atlas category key collision: "${key}" (plugin "${entry.plugin.name}" overwrites existing). Use unique namespaced keys.`);
          }
          data.categories[key] = items;
        }
        for (const stat of contribution.stats) {
          const countKey = stat.label.toLowerCase().replace(/\s+/g, "_");
          data.meta.object_counts[countKey] = stat.value;
        }
        ui.detail(`  Plugin "${entry.plugin.name}" contributed ${Object.keys(contribution.categories).length} categories.`);
      } catch (err) {
        ui.warn(`⚠️  Plugin "${entry.plugin.name}" getAtlasData failed: ${(err as Error).message}`);
      }
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 2) + "\n", "utf8");

  ui.success("Backend atlas data generated:");
  ui.detail(`- Output: ${OUT_FILE}`);
  ui.detail(`- Schemas: ${data.schemas.join(", ") || "(none)"}`);
  ui.detail(`- Functions: ${(data.categories.functions as unknown[]).length}, Policies: ${(data.categories.policies as unknown[]).length}`);
}
