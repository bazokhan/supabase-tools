/**
 * Database queries for ERD generation.
 * Fetches tables, columns, foreign keys, and referenced entity columns.
 */
import type { Client } from "pg";
import type { ColumnInfo, ForeignKeyInfo, ReferencedColumn } from "./builder.js";

/** List public table names. */
export async function fetchTables(client: Client): Promise<string[]> {
  const result = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  return result.rows.map((r) => r.tablename);
}

/** Fetch columns with PK/FK flags for all public tables. */
export async function fetchColumns(client: Client): Promise<Map<string, ColumnInfo[]>> {
  const result = await client.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: string;
    is_primary_key: boolean;
    is_foreign_key: boolean;
  }>(`
    SELECT
      c.table_name, c.column_name, c.data_type, c.udt_name, c.is_nullable,
      COALESCE(pk.is_pk, false) AS is_primary_key,
      COALESCE(fk.is_fk, false) AS is_foreign_key
    FROM information_schema.columns c
    LEFT JOIN LATERAL (
      SELECT true AS is_pk FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = c.table_schema AND tc.table_name = c.table_name AND kcu.column_name = c.column_name LIMIT 1
    ) pk ON true
    LEFT JOIN LATERAL (
      SELECT true AS is_fk FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = c.table_schema AND tc.table_name = c.table_name AND kcu.column_name = c.column_name LIMIT 1
    ) fk ON true
    WHERE c.table_schema = 'public'
    ORDER BY c.table_name, c.ordinal_position
  `);

  const byTable = new Map<string, ColumnInfo[]>();
  for (const row of result.rows) {
    const list = byTable.get(row.table_name) ?? [];
    list.push({
      column_name: row.column_name,
      data_type: row.data_type,
      udt_name: row.udt_name,
      is_nullable: row.is_nullable,
      is_primary_key: row.is_primary_key,
      is_foreign_key: row.is_foreign_key,
    });
    byTable.set(row.table_name, list);
  }
  return byTable;
}

/** Fetch foreign key definitions for public tables. */
export async function fetchForeignKeys(client: Client): Promise<Map<string, ForeignKeyInfo[]>> {
  const result = await client.query<{
    table_name: string;
    column_name: string;
    foreign_table_schema: string;
    foreign_table_name: string;
    foreign_column_name: string;
    delete_rule: string;
    is_nullable: string;
  }>(`
    SELECT
      kcu.table_name, kcu.column_name,
      ccu.table_schema AS foreign_table_schema, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name,
      rc.delete_rule, c.is_nullable
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.constraint_schema
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
    JOIN information_schema.columns c ON c.table_schema = kcu.table_schema AND c.table_name = kcu.table_name AND c.column_name = kcu.column_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY kcu.table_name, kcu.ordinal_position
  `);

  const byTable = new Map<string, ForeignKeyInfo[]>();
  for (const row of result.rows) {
    const list = byTable.get(row.table_name) ?? [];
    list.push({
      column_name: row.column_name,
      foreign_table_schema: row.foreign_table_schema,
      foreign_table_name: row.foreign_table_name,
      foreign_column_name: row.foreign_column_name,
      delete_rule: row.delete_rule,
      is_nullable: row.is_nullable,
    });
    byTable.set(row.table_name, list);
  }
  return byTable;
}

/** Known referenced entities we inline (no DB query). */
const KNOWN_REF_ENTITIES: Record<string, ReferencedColumn[]> = {
  "auth.users": [
    { column_name: "id", is_primary_key: true, is_foreign_key: false, data_type: "uuid", udt_name: "uuid" },
    { column_name: "email", is_primary_key: false, is_foreign_key: false, data_type: "text", udt_name: "text" },
  ],
};

/** Fetch columns for referenced entities (FK targets outside or in other schemas). */
export async function fetchReferencedEntities(
  client: Client,
  fksByTable: Map<string, ForeignKeyInfo[]>,
  displayColumns: string[],
): Promise<Map<string, ReferencedColumn[]>> {
  const refTableKeys = new Set<string>();
  for (const fks of fksByTable.values()) {
    for (const fk of fks) {
      refTableKeys.add(`${fk.foreign_table_schema}.${fk.foreign_table_name}`);
    }
  }

  const result = new Map<string, ReferencedColumn[]>();

  for (const key of refTableKeys) {
    const known = KNOWN_REF_ENTITIES[key];
    if (known) {
      result.set(key, known);
      continue;
    }

    const [schema, table] = key.split(".");
    const refColsResult = await client.query<ReferencedColumn & { data_type: string; udt_name: string }>(
      `
      SELECT c.column_name, c.data_type, c.udt_name,
        COALESCE(pk.is_pk, false) AS is_primary_key,
        COALESCE(fk.is_fk, false) AS is_foreign_key
      FROM information_schema.columns c
      LEFT JOIN LATERAL (
        SELECT true AS is_pk FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = c.table_schema AND tc.table_name = c.table_name AND kcu.column_name = c.column_name LIMIT 1
      ) pk ON true
      LEFT JOIN LATERAL (
        SELECT true AS is_fk FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = c.table_schema AND tc.table_name = c.table_name AND kcu.column_name = c.column_name LIMIT 1
      ) fk ON true
      WHERE c.table_schema = $1 AND c.table_name = $2
        AND (
          COALESCE((SELECT true FROM information_schema.table_constraints tc2
            JOIN information_schema.key_column_usage kcu2 ON tc2.constraint_name = kcu2.constraint_name AND tc2.table_schema = kcu2.table_schema
            WHERE tc2.constraint_type = 'PRIMARY KEY' AND tc2.table_schema = c.table_schema AND tc2.table_name = c.table_name AND kcu2.column_name = c.column_name LIMIT 1
          ), false) = true
          OR c.column_name = ANY($3)
        )
      ORDER BY c.ordinal_position
    `,
      [schema, table, displayColumns],
    );

    if (refColsResult.rows.length > 0) {
      result.set(
        key,
        refColsResult.rows.map((r) => ({
          column_name: r.column_name,
          is_primary_key: r.is_primary_key,
          is_foreign_key: r.is_foreign_key,
          data_type: r.data_type,
          udt_name: r.udt_name,
        })),
      );
    }
  }

  return result;
}
