/**
 * Generate CREATE INDEX migration.
 *
 * Does NOT require an existing intent graph.
 */
import fs from "node:fs";
import path from "node:path";
import type { PluginContext } from "@sbtools/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IndexMethod = "btree" | "hash" | "gin" | "gist" | "brin";

export interface AddIndexInput {
  /** Entity ID in "schema.table" format, e.g. "public.users" */
  entityId: string;
  index: {
    /** Auto-generated as <table>_<col1>_<col2>_idx if not provided. */
    name?: string;
    columns: string[];
    /** Default: false */
    unique?: boolean;
    /** Default: btree */
    method?: IndexMethod;
    /** Partial index WHERE predicate. */
    where?: string;
  };
}

// ---------------------------------------------------------------------------
// SQL generation
// ---------------------------------------------------------------------------

function escapeIdentifier(id: string): string {
  if (/^[a-z_][a-z0-9_]*$/i.test(id)) return id;
  return `"${id.replace(/"/g, '""')}"`;
}

export function buildAddIndexSql(input: AddIndexInput): string {
  const parts = input.entityId.split(".");
  const schema = parts.length >= 2 ? parts[0] : "public";
  const table = parts.length >= 2 ? parts[1] : (parts[0] ?? input.entityId);

  const { index } = input;
  const method = index.method ?? "btree";
  const unique = index.unique ? "UNIQUE " : "";

  const autoName = `${table}_${index.columns.join("_")}_idx`;
  const indexName = escapeIdentifier(index.name ?? autoName);
  const colList = index.columns.map(escapeIdentifier).join(", ");

  let sql =
    `CREATE ${unique}INDEX ${indexName}` +
    ` ON ${escapeIdentifier(schema)}.${escapeIdentifier(table)}` +
    ` USING ${method} (${colList})`;

  if (index.where) {
    sql += ` WHERE ${index.where}`;
  }
  sql += ";";

  return sql;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runAddIndex(
  ctx: PluginContext,
  input: AddIndexInput
): Promise<{ sql: string; filename: string }> {
  const sql = buildAddIndexSql(input);

  const migrationsDir = ctx.paths?.migrations ?? path.join(ctx.projectRoot, "supabase", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  const parts = input.entityId.split(".");
  const table = parts.length >= 2 ? parts[1] : (parts[0] ?? input.entityId);
  const colSlug = input.index.columns.join("_");
  const slug = `${table}_${colSlug}`.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  const timestamp = Date.now();
  const filename = `${timestamp}_add_index_${slug}.sql`;
  const filePath = path.join(migrationsDir, filename);
  fs.writeFileSync(filePath, sql + "\n", "utf8");

  return { sql, filename };
}
