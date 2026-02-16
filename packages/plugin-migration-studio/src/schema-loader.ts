/**
 * Multi-source schema introspection. Priority: DB (full) → atlas-data → artifact → none.
 */
import fs from "node:fs";
import path from "node:path";
import type { PluginContext } from "@sbtools/sdk";
import { createPgClient, testConnection, disconnectClient, readArtifactOrNull } from "@sbtools/sdk";
import type { StudioSchema } from "./types.js";

export async function loadSchema(ctx: PluginContext): Promise<StudioSchema> {
  // 1. Try DB first (full column data)
  const fromDb = await loadFromDatabase();
  if (fromDb) return fromDb;

  // 2. Try atlas-data.json
  const fromAtlas = loadFromAtlasData(ctx);
  if (fromAtlas) return fromAtlas;

  // 3. Try migration.analysis artifact
  const fromArtifact = loadFromArtifact(ctx);
  if (fromArtifact) return fromArtifact;

  return {
    tables: {},
    functions: [],
    types: [],
    enums: {},
    schemas: [],
    views: [],
    source: "none",
  };
}

async function loadFromDatabase(): Promise<StudioSchema | null> {
  const client = createPgClient();
  try {
    const ok = await testConnection(client);
    if (!ok) return null;

    const [columnsRes, tablesRes, funcsRes, typesRes, enumsRes, schemasRes, viewsRes] = await Promise.all([
      client.query<{ table_schema: string; table_name: string; column_name: string }>(
        `SELECT table_schema, table_name, column_name FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name, ordinal_position`
      ),
      client.query<{ schemaname: string; tablename: string }>(
        `SELECT schemaname, tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY schemaname, tablename`
      ),
      client.query<{ nspname: string; proname: string }>(
        `SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY n.nspname, p.proname`
      ),
      client.query<{ nspname: string; typname: string }>(
        `SELECT n.nspname, t.typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typtype = 'b' AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY n.nspname, t.typname`
      ),
      client.query<{ nspname: string; typname: string; enumlabel: string }>(
        `SELECT n.nspname, t.typname, e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY n.nspname, t.typname, e.enumsortorder`
      ),
      client.query<{ schema_name: string }>(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema') ORDER BY schema_name`
      ),
      client.query<{ table_schema: string; table_name: string }>(
        `SELECT table_schema, table_name FROM information_schema.views WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name`
      ),
    ]);

    const tables: Record<string, string[]> = {};
    for (const row of columnsRes.rows) {
      const key = row.table_schema === "public" ? row.table_name : `${row.table_schema}.${row.table_name}`;
      if (!tables[key]) tables[key] = [];
      tables[key].push(row.column_name);
    }
    for (const row of tablesRes.rows) {
      const key = row.schemaname === "public" ? row.tablename : `${row.schemaname}.${row.tablename}`;
      if (!tables[key]) tables[key] = [];
    }

    const enums: Record<string, string[]> = {};
    for (const row of enumsRes.rows) {
      const key = row.nspname === "public" ? row.typname : `${row.nspname}.${row.typname}`;
      if (!enums[key]) enums[key] = [];
      enums[key].push(row.enumlabel);
    }

    await disconnectClient(client);

    return {
      tables,
      functions: funcsRes.rows.map((r) => (r.nspname === "public" ? r.proname : `${r.nspname}.${r.proname}`)),
      types: typesRes.rows.map((r) => (r.nspname === "public" ? r.typname : `${r.nspname}.${r.typname}`)),
      enums,
      schemas: schemasRes.rows.map((r) => r.schema_name),
      views: viewsRes.rows.map((r) => (r.table_schema === "public" ? r.table_name : `${r.table_schema}.${r.table_name}`)),
      source: "database",
    };
  } catch {
    try {
      await disconnectClient(client);
    } catch {
      // ignore
    }
    return null;
  }
}

function loadFromAtlasData(ctx: PluginContext): StudioSchema | null {
  const dataPath = path.join(ctx.paths.docsOutput, "backend-atlas-data.json");
  if (!fs.existsSync(dataPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    const categories = data.categories || {};
    const functions = (categories.functions || []).map((f: { name?: string; id?: string }) => f.name || f.id || "").filter(Boolean);
    const views = (categories.views || []).map((v: { name?: string; id?: string }) => v.name || v.id || "").filter(Boolean);
    const tables: Record<string, string[]> = {};
    for (const v of categories.views || []) {
      const name = (v as { schema?: string; name?: string }).name || (v as { id?: string }).id;
      if (name) tables[name] = [];
    }
    for (const v of categories.materialized_views || []) {
      const name = (v as { schema?: string; name?: string }).name || (v as { id?: string }).id;
      if (name) tables[name] = [];
    }
    return {
      tables,
      functions: functions.filter(Boolean),
      types: (categories.types || []).map((t: { name?: string }) => t.name).filter(Boolean),
      enums: {},
      schemas: data.schemas || [],
      views: views.filter(Boolean),
      source: "atlas-data",
    };
  } catch {
    return null;
  }
}

function loadFromArtifact(ctx: PluginContext): StudioSchema | null {
  const envelope = readArtifactOrNull(ctx, "migration.analysis", "1.0.0");
  if (!envelope?.data) return null;
  const data = envelope.data as { schema?: { publicTableNames?: string[] } };
  const names = data.schema?.publicTableNames || [];
  const tables: Record<string, string[]> = {};
  for (const n of names) tables[n] = [];
  return {
    tables,
    functions: [],
    types: [],
    enums: {},
    schemas: ["public"],
    views: [],
    source: "artifact",
  };
}
