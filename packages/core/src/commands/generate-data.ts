import fs from "node:fs";
import path from "node:path";
import { ui, SnapshotError, ensureDir, readText } from "@sbtools/sdk";
import type { AtlasData, SnapshotMeta, FunctionItem, ViewItem, TriggerItem, PolicyItem, TypeItem, EnumItem } from "@sbtools/sdk";
import { config, resolve } from "../config.js";
import { listSqlFiles } from "../utils/index.js";
import {
  parseHeader, parseArgs, parseReturns, parseVolatility,
  parseTriggerDetails, parsePolicyBlocks, parsePolicyDetail,
  parseEnumValues, extractDescription,
} from "../parsers/index.js";
import { loadPlugins, buildPluginContext } from "../plugin-loader.js";

function buildAtlasData(): AtlasData {
  const SNAPSHOT_DIR = resolve(config.paths.snapshot);
  const metaPath = path.join(SNAPSHOT_DIR, "_meta", "snapshot.json");
  if (!fs.existsSync(metaPath)) {
    throw new SnapshotError(`Snapshot metadata not found at ${metaPath}.`);
  }

  const meta = JSON.parse(readText(metaPath)) as SnapshotMeta;

  const functionsDir = path.join(SNAPSHOT_DIR, "functions");
  const viewsDir = path.join(SNAPSHOT_DIR, "views");
  const triggersDir = path.join(SNAPSHOT_DIR, "triggers");
  const policiesDir = path.join(SNAPSHOT_DIR, "policies");
  const typesDir = path.join(SNAPSHOT_DIR, "types");
  const enumsDir = path.join(SNAPSHOT_DIR, "enums");

  const functions: FunctionItem[] = listSqlFiles(functionsDir).map((filePath) => {
    const sql = readText(filePath).trim();
    const schema = parseHeader(sql, "Schema");
    const signatureLine = parseHeader(sql, "Function");
    const openIdx = signatureLine.indexOf("(");
    const name = openIdx >= 0 ? signatureLine.slice(0, openIdx).trim() : signatureLine.trim();
    const argsText = openIdx >= 0 ? signatureLine.slice(openIdx + 1, signatureLine.lastIndexOf(")")) : "";
    const args = parseArgs(argsText);
    const returns = parseReturns(sql);
    const volatility = parseVolatility(sql);
    const securityDefiner = /\bSECURITY\s+DEFINER\b/i.test(sql);
    const description = extractDescription(sql);

    return {
      id: `${schema}.${name}(${argsText})`, kind: "function", schema, name,
      signature: signatureLine, args, returns, volatility,
      security_definer: securityDefiner, sql, description: description || undefined,
    };
  });

  const views: ViewItem[] = [];
  const materializedViews: ViewItem[] = [];
  for (const filePath of listSqlFiles(viewsDir)) {
    const sql = readText(filePath).trim();
    const schema = parseHeader(sql, "Schema");
    const viewName = parseHeader(sql, "View");
    const matName = parseHeader(sql, "Materialized View");
    const name = viewName || matName;
    const kind = matName ? "materialized_view" : "view";
    const item: ViewItem = { id: `${schema}.${name}`, kind, schema, name, sql };
    if (kind === "materialized_view") materializedViews.push(item);
    else views.push(item);
  }

  const triggers: TriggerItem[] = listSqlFiles(triggersDir).map((filePath) => {
    const sql = readText(filePath).trim();
    const schema = parseHeader(sql, "Schema");
    const table = parseHeader(sql, "Table");
    const name = parseHeader(sql, "Trigger");
    const details = parseTriggerDetails(sql);
    return {
      id: `${schema}.${table}.${name}`, kind: "trigger", schema, name, table,
      timing: details.timing, events: details.events, function_name: details.function_name, sql,
    };
  });

  const policies: PolicyItem[] = [];
  for (const filePath of listSqlFiles(policiesDir)) {
    const sql = readText(filePath).trim();
    const tableMatch = sql.match(/current RLS policies for\s+([^\s]+)/i);
    const tableFull = tableMatch ? tableMatch[1].trim() : "";
    const [schema, table] = tableFull.includes(".") ? tableFull.split(".") : ["", tableFull];
    const blocks = parsePolicyBlocks(sql);
    for (const block of blocks) {
      const detail = parsePolicyDetail(block.sql);
      policies.push({
        id: `${schema}.${table}.${block.name}`, kind: "policy", schema, name: block.name, table,
        permissive: detail.permissive, command: detail.command, roles: detail.roles,
        using: detail.using, with_check: detail.with_check, sql: block.sql,
      });
    }
  }

  const types: TypeItem[] = listSqlFiles(typesDir).map((filePath) => {
    const sql = readText(filePath).trim();
    const schema = parseHeader(sql, "Schema");
    const typeLine = parseHeader(sql, "Type");
    const name = typeLine.split("(")[0].trim();
    const typeKindMatch = typeLine.match(/\(([^)]+)\)/);
    const typeKind = typeKindMatch ? typeKindMatch[1].trim() : "";
    return { id: `${schema}.${name}`, kind: "type", schema, name, type_kind: typeKind, sql };
  });

  const enums: EnumItem[] = listSqlFiles(enumsDir).map((filePath) => {
    const sql = readText(filePath).trim();
    const schema = parseHeader(sql, "Schema");
    const name = parseHeader(sql, "Enum");
    const values = parseEnumValues(sql);
    return { id: `${schema}.${name}`, kind: "enum", schema, name, values, sql };
  });

  const schemas = new Set<string>();
  [...functions, ...views, ...materializedViews, ...triggers, ...policies, ...types, ...enums]
    .forEach((item) => { if (item.schema) schemas.add(item.schema); });

  return {
    meta: { ...meta, generated_at: new Date().toISOString() },
    schemas: Array.from(schemas).sort(),
    categories: { functions, views, materialized_views: materializedViews, triggers, policies, types, enums },
  };
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
