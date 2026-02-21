/**
 * studio-introspect: Query the live DB → build full SchemaSnapshotData → write studio.schema.snapshot.
 *
 * Reads from pg_catalog / information_schema. System schemas are excluded.
 * All discovered nodes default to managedStatus:'managed', confidence:0.9
 * (live DB is the authoritative source; intent-sync will adjust confidence later).
 */
import pg from "pg";
import type { PluginContext } from "@sbtools/sdk";
import type {
  EntityNode,
  ColumnNode,
  ConstraintNode,
  IndexNode,
  PolicyNode,
  ViewNode,
  FunctionNode,
  TriggerNode,
  InfraNode,
} from "@sbtools/sdk";
import { writeSchemaSnapshotArtifact } from "../../artifacts/writers.js";

const { Client } = pg;

// Schemas owned by Supabase infrastructure — never managed by studio.
const SYSTEM_SCHEMAS = [
  "auth",
  "storage",
  "realtime",
  "supabase_functions",
  "extensions",
  "pg_catalog",
  "pg_toast",
  "information_schema",
];

const SYSTEM_SCHEMAS_SQL = SYSTEM_SCHEMAS.map((s) => `'${s}'`).join(", ");

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

async function query(client: pg.Client, sql: string): Promise<Row[]> {
  const result = await client.query(sql);
  return result.rows as Row[];
}

function str(v: unknown): string {
  return typeof v === "string" ? v : String(v ?? "");
}

function bool(v: unknown): boolean {
  return v === true || v === "YES" || v === "t";
}

// ---------------------------------------------------------------------------
// Node builders
// ---------------------------------------------------------------------------

function buildEntityNodes(
  tableRows: Row[],
  columnRows: Row[],
  constraintRows: Row[],
  indexRows: Row[]
): EntityNode[] {
  // Group columns by table
  const colsByTable = new Map<string, ColumnNode[]>();
  for (const row of columnRows) {
    const key = `${str(row["table_schema"])}.${str(row["table_name"])}`;
    if (!colsByTable.has(key)) colsByTable.set(key, []);
    colsByTable.get(key)!.push({
      name: str(row["column_name"]),
      type: str(row["udt_name"]),
      nullable: bool(row["is_nullable"]),
      default: row["column_default"] != null ? str(row["column_default"]) : undefined,
      identity: row["identity_generation"]
        ? (str(row["identity_generation"]).toLowerCase().replace(" ", "-") as "always" | "by-default")
        : undefined,
      generated: row["generation_expression"] != null ? str(row["generation_expression"]) : undefined,
      managedStatus: "managed",
      confidence: 0.9,
    });
  }

  // Group constraints by table
  const consByTable = new Map<string, ConstraintNode[]>();
  for (const row of constraintRows) {
    const key = `${str(row["schema_name"])}.${str(row["table_name"])}`;
    if (!consByTable.has(key)) consByTable.set(key, []);
    const contype = str(row["contype"]);
    const typeMap: Record<string, ConstraintNode["type"]> = {
      p: "primary_key",
      u: "unique",
      c: "check",
      f: "foreign_key",
      x: "exclusion",
    };
    const cols = row["columns"] as string[] | null;
    consByTable.get(key)!.push({
      name: str(row["conname"]),
      type: typeMap[contype] ?? "check",
      columns: Array.isArray(cols) ? cols : [],
      definition: str(row["definition"]),
    });
  }

  // Group indexes by table
  const idxByTable = new Map<string, IndexNode[]>();
  for (const row of indexRows) {
    const key = `${str(row["schemaname"])}.${str(row["tablename"])}`;
    if (!idxByTable.has(key)) idxByTable.set(key, []);
    const method = str(row["amname"]).toLowerCase();
    idxByTable.get(key)!.push({
      name: str(row["indexname"]),
      columns: [], // column names require additional parsing of indexdef
      unique: bool(row["indisunique"]),
      method: (["btree", "hash", "gin", "gist", "brin"].includes(method) ? method : "btree") as IndexNode["method"],
      where: row["where_clause"] ? str(row["where_clause"]) : undefined,
      definition: str(row["definition"]),
    });
  }

  // Build EntityNode per table
  return tableRows.map((row) => {
    const schema = str(row["table_schema"]);
    const name = str(row["table_name"]);
    const id = `${schema}.${name}`;
    return {
      id,
      schema,
      name,
      managedStatus: "managed",
      confidence: 0.9,
      columns: colsByTable.get(id) ?? [],
      constraints: consByTable.get(id) ?? [],
      indexes: idxByTable.get(id) ?? [],
    };
  });
}

function buildPolicyNodes(rows: Row[]): PolicyNode[] {
  const cmdMap: Record<string, PolicyNode["command"]> = {
    r: "SELECT",
    a: "INSERT",
    w: "UPDATE",
    d: "DELETE",
    "*": "ALL",
  };
  return rows.map((row) => {
    const schema = str(row["schema_name"]);
    const table = str(row["table_name"]);
    const entityId = `${schema}.${table}`;
    const name = str(row["polname"]);
    const roles = Array.isArray(row["roles"]) ? (row["roles"] as string[]) : [];
    return {
      id: `${entityId}.${name}`,
      entity: entityId,
      name,
      command: cmdMap[str(row["polcmd"])] ?? "ALL",
      roles,
      using: row["using_expr"] ? str(row["using_expr"]) : undefined,
      withCheck: row["with_check_expr"] ? str(row["with_check_expr"]) : undefined,
      permissive: bool(row["polpermissive"]),
      managedStatus: "managed",
      confidence: 0.9,
    };
  });
}

function buildViewNodes(rows: Row[]): ViewNode[] {
  return rows.map((row) => {
    const schema = str(row["schema"]);
    const name = str(row["name"]);
    return {
      id: `${schema}.${name}`,
      schema,
      name,
      materialized: bool(row["materialized"]),
      query: str(row["query"]),
      columns: [],
      managedStatus: "managed",
      confidence: 0.9,
    };
  });
}

function buildFunctionNodes(rows: Row[]): FunctionNode[] {
  return rows.map((row) => {
    const schema = str(row["routine_schema"]);
    const name = str(row["routine_name"]);
    const lang = str(row["external_language"]).toLowerCase() as FunctionNode["language"];
    const security = str(row["security_type"]).toLowerCase() === "definer" ? "definer" : "invoker";
    return {
      id: `${schema}.${name}`,
      schema,
      name,
      args: [],
      returnType: str(row["data_type"]),
      language: (["sql", "plpgsql", "plv8"].includes(lang) ? lang : "plpgsql") as FunctionNode["language"],
      security: security as "invoker" | "definer",
      volatility: "volatile",
      managedStatus: "managed",
      confidence: 0.9,
    };
  });
}

function buildTriggerNodes(rows: Row[]): TriggerNode[] {
  // tgtype bitmask: BEFORE=2, AFTER=4, INSTEAD OF=64, INSERT=4, UPDATE=8, DELETE=16, TRUNCATE=32
  // Postgres internal: bits 0=ROW, 1=BEFORE, 2=INSERT, 3=DELETE, 4=UPDATE, 5=TRUNCATE, 6=INSTEAD OF
  return rows.map((row) => {
    const schema = str(row["nspname"]);
    const table = str(row["relname"]);
    const name = str(row["tgname"]);
    const tgtype = Number(row["tgtype"] ?? 0);

    const timing: TriggerNode["timing"] =
      tgtype & 64 ? "INSTEAD OF" : tgtype & 2 ? "BEFORE" : "AFTER";

    const events: TriggerNode["events"] = [];
    if (tgtype & 4) events.push("INSERT");
    if (tgtype & 8) events.push("UPDATE");
    if (tgtype & 16) events.push("DELETE");
    if (tgtype & 32) events.push("TRUNCATE");

    return {
      id: `trigger:${schema}.${table}.${name}`,
      entity: `${schema}.${table}`,
      name,
      timing,
      events,
      forEach: tgtype & 1 ? "ROW" : "STATEMENT",
      function: name, // placeholder — would need pg_proc join for the real fn name
      managedStatus: "managed",
      confidence: 0.9,
    };
  });
}

function buildInfraNodes(extRows: Row[]): InfraNode[] {
  return extRows.map((row) => ({
    id: `extension:${str(row["extname"])}`,
    type: "extension" as const,
    name: str(row["extname"]),
    details: { version: str(row["extversion"]) },
    managedStatus: "managed" as const,
  }));
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runIntrospect(ctx: PluginContext): Promise<void> {
  const dbUrl =
    (ctx.pluginConfig as Record<string, unknown>)?.["dbUrl"] as string | undefined ||
    ((ctx.pluginConfig as Record<string, unknown>)?.["db"] as Record<string, unknown> | undefined)?.["url"] as string | undefined ||
    process.env["DATABASE_URL"] ||
    process.env["SUPABASE_DB_URL"] ||
    "postgresql://postgres:postgres@localhost:54322/postgres";

  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
  } catch (err) {
    throw Object.assign(new Error(`DB connection failed: ${(err as Error).message}`), {
      code: "DB_CONNECT_ERROR",
    });
  }

  try {
    const [tableRows, columnRows, constraintRows, indexRows, policyRows, viewRows, fnRows, triggerRows, extRows, versionRows] =
      await Promise.all([
        // Tables
        query(
          client,
          `SELECT table_schema, table_name
           FROM information_schema.tables
           WHERE table_type = 'BASE TABLE'
             AND table_schema NOT IN (${SYSTEM_SCHEMAS_SQL})
           ORDER BY table_schema, table_name`
        ),
        // Columns
        query(
          client,
          `SELECT table_schema, table_name, column_name, udt_name,
                  is_nullable, column_default, identity_generation, generation_expression
           FROM information_schema.columns
           WHERE table_schema NOT IN (${SYSTEM_SCHEMAS_SQL})
           ORDER BY table_schema, table_name, ordinal_position`
        ),
        // Constraints (PK, UNIQUE, CHECK, FK)
        query(
          client,
          `SELECT n.nspname AS schema_name, c.relname AS table_name,
                  con.conname, con.contype,
                  pg_get_constraintdef(con.oid) AS definition,
                  ARRAY(
                    SELECT a.attname FROM pg_attribute a
                    WHERE a.attrelid = c.oid
                      AND a.attnum = ANY(con.conkey)
                    ORDER BY a.attnum
                  ) AS columns
           FROM pg_constraint con
           JOIN pg_class c ON c.oid = con.conrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname NOT IN (${SYSTEM_SCHEMAS_SQL})
             AND con.contype IN ('p','u','c','f')`
        ),
        // Indexes (excluding PK backing indexes)
        query(
          client,
          `SELECT n.nspname AS schemaname, t.relname AS tablename,
                  i.relname AS indexname, ix.indisunique,
                  am.amname,
                  pg_get_expr(ix.indpred, ix.indrelid, true) AS where_clause,
                  pg_get_indexdef(i.oid) AS definition
           FROM pg_index ix
           JOIN pg_class t ON t.oid = ix.indrelid
           JOIN pg_class i ON i.oid = ix.indexrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace
           JOIN pg_am am ON am.oid = i.relam
           WHERE n.nspname NOT IN (${SYSTEM_SCHEMAS_SQL})
             AND NOT ix.indisprimary`
        ),
        // RLS Policies
        query(
          client,
          `SELECT p.polname, n.nspname AS schema_name, c.relname AS table_name,
                  p.polcmd, p.polpermissive,
                  pg_get_expr(p.polqual, p.polrelid) AS using_expr,
                  pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expr,
                  ARRAY(
                    SELECT r.rolname FROM pg_roles r
                    WHERE r.oid = ANY(p.polroles)
                  ) AS roles
           FROM pg_policy p
           JOIN pg_class c ON c.oid = p.polrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname NOT IN (${SYSTEM_SCHEMAS_SQL})`
        ),
        // Views + materialized views
        query(
          client,
          `SELECT table_schema AS schema, table_name AS name, view_definition AS query, false AS materialized
           FROM information_schema.views
           WHERE table_schema NOT IN (${SYSTEM_SCHEMAS_SQL})
           UNION ALL
           SELECT schemaname, matviewname, definition, true
           FROM pg_matviews
           WHERE schemaname NOT IN (${SYSTEM_SCHEMAS_SQL})`
        ),
        // Functions
        query(
          client,
          `SELECT routine_schema, routine_name, external_language, security_type, data_type
           FROM information_schema.routines
           WHERE routine_type = 'FUNCTION'
             AND routine_schema NOT IN (${SYSTEM_SCHEMAS_SQL})`
        ),
        // Triggers
        query(
          client,
          `SELECT n.nspname, c.relname, t.tgname, t.tgtype
           FROM pg_trigger t
           JOIN pg_class c ON c.oid = t.tgrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE NOT t.tgisinternal
             AND n.nspname NOT IN (${SYSTEM_SCHEMAS_SQL})`
        ),
        // Extensions
        query(client, `SELECT extname, extversion FROM pg_extension ORDER BY extname`),
        // PG version
        query(client, `SELECT version()`),
      ]);

    const pgVersionStr = versionRows[0] ? str(versionRows[0]["version"]) : undefined;

    const entities = buildEntityNodes(tableRows, columnRows, constraintRows, indexRows);
    const policies = buildPolicyNodes(policyRows);
    const views = buildViewNodes(viewRows);
    const functions = buildFunctionNodes(fnRows);
    const triggers = buildTriggerNodes(triggerRows);
    const infrastructure = buildInfraNodes(extRows);

    writeSchemaSnapshotArtifact(ctx, {
      capturedAt: new Date().toISOString(),
      pgVersion: pgVersionStr,
      entities,
      views,
      functions,
      policies,
      triggers,
      infrastructure,
    });
  } finally {
    await client.end().catch(() => {});
  }
}

