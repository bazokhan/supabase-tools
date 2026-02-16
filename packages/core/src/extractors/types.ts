import type { Client } from "pg";
import type { SnapshotContext, TypeRow } from "@sbtools/sdk";
import { safeName, safeFileName, writeFileInDir } from "@sbtools/sdk";
import { formatTypeFile } from "../generators/index.js";

/**
 * Extracts custom types (composite and domain), writes one file per type, updates meta.object_counts.types.
 *
 * @param client - Connected Postgres client.
 * @param ctx - Snapshot context (outDir, schemaFilterNsp, meta).
 */
export async function extractTypes(
  client: Client,
  ctx: SnapshotContext
): Promise<void> {
  const res = await client.query(
    `
    SELECT
      n.nspname AS schema,
      t.typname AS name,
      pg_catalog.format_type(t.oid, NULL) AS definition,
      CASE
        WHEN t.typtype = 'c' THEN 'composite'
        WHEN t.typtype = 'd' THEN 'domain'
        ELSE 'other'
      END AS type_kind
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND t.typtype IN ('c', 'd')
      AND NOT EXISTS (
        SELECT 1 FROM pg_type e
        WHERE e.oid = t.typelem AND e.typarray = t.oid
      )
      ${ctx.schemaFilterNsp.clause}
    ORDER BY n.nspname, t.typname;
  `,
    ctx.schemaFilterNsp.params
  );

  for (const r of res.rows as TypeRow[]) {
    let ddl = `CREATE TYPE ${r.schema}.${r.name} AS ();`;
    if (r.type_kind === "composite") {
      const attrsRes = await client.query(
        `
        SELECT
          a.attname AS name,
          pg_catalog.format_type(a.atttypid, a.atttypmod) AS type
        FROM pg_attribute a
        JOIN pg_type t ON a.attrelid = t.oid
        WHERE t.typname = $1 AND t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = $2)
          AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum;
      `,
        [r.name, r.schema]
      );
      const attrs = attrsRes.rows as { name: string; type: string }[];
      if (attrs.length > 0) {
        ddl = `CREATE TYPE ${r.schema}.${r.name} AS (\n${attrs.map((a) => `  ${a.name} ${a.type}`).join(",\n")}\n);`;
      }
    } else if (r.type_kind === "domain") {
      ddl = `CREATE DOMAIN ${r.schema}.${r.name} AS ${r.definition};`;
    }

    const baseFileName = `types/${safeName(r.schema)}.${safeName(r.name)}.sql`;
    const file = safeFileName(baseFileName);
    writeFileInDir(ctx.outDir, file, formatTypeFile(r, ddl));
    ctx.meta.object_counts.types++;
  }
}
