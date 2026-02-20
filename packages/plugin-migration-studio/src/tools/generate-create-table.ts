/**
 * Generate CREATE TABLE migration.
 *
 * This tool does NOT require an existing intent graph — it is safe for greenfield projects.
 * If an intent graph exists, the new entity is appended to it after file creation.
 */
import fs from "node:fs";
import path from "node:path";
import type { PluginContext } from "@sbtools/sdk";
import { readArtifactOrNull, writeArtifact } from "@sbtools/sdk";
import type { IntentGraph } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../artifacts/constants.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateTableColumnInput {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  /** If true and type is uuid: DEFAULT gen_random_uuid(). Otherwise: GENERATED ALWAYS AS IDENTITY. */
  identity?: boolean;
  /** Mark this column as part of the primary key (alternative to top-level primaryKey array). */
  primaryKey?: boolean;
}

export interface CreateTableInput {
  schema: string;
  name: string;
  columns: CreateTableColumnInput[];
  /** Explicit primary key column names. Overrides column-level primaryKey flags. */
  primaryKey?: string[];
  /** Default: true — always enable RLS for Supabase tables. */
  enableRls?: boolean;
}

// ---------------------------------------------------------------------------
// SQL generation helpers
// ---------------------------------------------------------------------------

function escapeIdentifier(id: string): string {
  if (/^[a-z_][a-z0-9_]*$/i.test(id)) return id;
  return `"${id.replace(/"/g, '""')}"`;
}

function determinePrimaryKey(input: CreateTableInput): string[] {
  if (input.primaryKey && input.primaryKey.length > 0) return input.primaryKey;
  const explicit = input.columns.filter((c) => c.primaryKey).map((c) => c.name);
  if (explicit.length > 0) return explicit;
  const idCol = input.columns.find((c) => c.name === "id");
  if (idCol) return ["id"];
  return [];
}

function buildColumnDef(col: CreateTableColumnInput, isPk: boolean, isSinglePk: boolean): string {
  const colId = escapeIdentifier(col.name);
  let def = `  ${colId} ${col.type}`;

  // Inline PRIMARY KEY for single-PK tables
  if (isPk && isSinglePk) {
    def += " PRIMARY KEY";
  }

  // NOT NULL: skip for single-PK column (PK implies NOT NULL) and for nullable columns
  if (!col.nullable && !(isPk && isSinglePk)) {
    def += " NOT NULL";
  }

  // DEFAULT or IDENTITY
  if (col.default != null && col.default !== "") {
    def += ` DEFAULT ${col.default}`;
  } else if (col.identity) {
    if (col.type.toLowerCase().includes("uuid")) {
      def += " DEFAULT gen_random_uuid()";
    } else {
      def += " GENERATED ALWAYS AS IDENTITY";
    }
  }

  return def;
}

export function buildCreateTableSql(input: CreateTableInput): string {
  const schemaId = escapeIdentifier(input.schema);
  const tableId = escapeIdentifier(input.name);
  const pkCols = determinePrimaryKey(input);
  const isSinglePk = pkCols.length === 1;
  const enableRls = input.enableRls !== false;

  const lines: string[] = [];
  for (const col of input.columns) {
    lines.push(buildColumnDef(col, pkCols.includes(col.name), isSinglePk));
  }

  if (pkCols.length > 1) {
    const pkList = pkCols.map(escapeIdentifier).join(", ");
    lines.push(`  PRIMARY KEY (${pkList})`);
  }

  let sql = `CREATE TABLE ${schemaId}.${tableId} (\n${lines.join(",\n")}\n);`;
  if (enableRls) {
    sql += `\nALTER TABLE ${schemaId}.${tableId} ENABLE ROW LEVEL SECURITY;`;
  }
  return sql;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runCreateTable(
  ctx: PluginContext,
  input: CreateTableInput
): Promise<{ sql: string; filename: string }> {
  const sql = buildCreateTableSql(input);

  const migrationsDir = ctx.paths?.migrations ?? path.join(ctx.projectRoot, "supabase", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  const slug = `${input.schema}_${input.name}`.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  const timestamp = Date.now();
  const filename = `${timestamp}_create_table_${slug}.sql`;
  const filePath = path.join(migrationsDir, filename);
  fs.writeFileSync(filePath, sql + "\n", "utf8");

  // Optionally append entity to intent graph if one exists (greenfield-safe: no error if missing)
  const graphEnv = readArtifactOrNull<IntentGraph>(
    ctx,
    STUDIO_ARTIFACTS.INTENT_GRAPH.id,
    STUDIO_ARTIFACTS.INTENT_GRAPH.version
  );
  if (graphEnv?.data) {
    const entityId = `${input.schema}.${input.name}`;
    const alreadyExists = graphEnv.data.entities.some((e) => e.id === entityId);
    if (!alreadyExists) {
      const pkCols = determinePrimaryKey(input);
      const newEntity = {
        id: entityId,
        schema: input.schema,
        name: input.name,
        managedStatus: "managed" as const,
        confidence: 1.0,
        columns: input.columns.map((c) => ({
          name: c.name,
          type: c.type,
          nullable: c.nullable,
          default: c.default,
          identity: c.identity ? ("by-default" as const) : undefined,
          managedStatus: "managed" as const,
          confidence: 1.0,
        })),
        constraints:
          pkCols.length > 0
            ? [
                {
                  name: `${input.name}_pkey`,
                  type: "primary_key" as const,
                  columns: pkCols,
                  definition: `PRIMARY KEY (${pkCols.join(", ")})`,
                },
              ]
            : [],
        indexes: [],
      };
      const updatedGraph: IntentGraph = {
        ...graphEnv.data,
        entities: [...graphEnv.data.entities, newEntity],
      };
      writeArtifact(ctx, {
        id: STUDIO_ARTIFACTS.INTENT_GRAPH.id,
        version: STUDIO_ARTIFACTS.INTENT_GRAPH.version,
        producer: "studio-create-table",
        generatedAt: new Date().toISOString(),
        data: updatedGraph,
      });
    }
  }

  return { sql, filename };
}
