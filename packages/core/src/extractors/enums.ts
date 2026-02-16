import type { Client } from "pg";
import type { SnapshotContext, EnumRow } from "@sbtools/sdk";
import { safeName, safeFileName, writeFileInDir, ui } from "@sbtools/sdk";
import { formatEnumFile } from "../generators/index.js";

/**
 * Extracts enum types, writes one file per enum, updates meta.object_counts.enums.
 *
 * @param client - Connected Postgres client.
 * @param ctx - Snapshot context (outDir, schemaFilterNsp, meta).
 */
export async function extractEnums(
  client: Client,
  ctx: SnapshotContext
): Promise<void> {
  const res = await client.query(
    `
    SELECT
      n.nspname AS schema,
      t.typname AS name,
      array_agg(e.enumlabel ORDER BY e.enumsortorder)::text[] AS values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      ${ctx.schemaFilterNsp.clause}
    GROUP BY n.nspname, t.typname
    ORDER BY n.nspname, t.typname;
  `,
    ctx.schemaFilterNsp.params
  );

  for (const r of res.rows as EnumRow[]) {
    let values: string[];
    if (Array.isArray(r.values)) {
      values = r.values;
    } else if (typeof r.values === "string") {
      const match = r.values.match(/^\{(.+)\}$/);
      if (match) {
        values = match[1].split(",").map((v: string) => v.trim().replace(/^"|"$/g, ""));
      } else {
        values = [r.values];
      }
    } else {
      ui.warn(`   ⚠️  Unexpected enum values format for ${r.schema}.${r.name}, skipping`);
      continue;
    }

    const valuesStr = values.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(", ");
    const ddl = `CREATE TYPE ${r.schema}.${r.name} AS ENUM (\n  ${valuesStr}\n);`;

    const baseFileName = `enums/${safeName(r.schema)}.${safeName(r.name)}.sql`;
    const file = safeFileName(baseFileName);
    writeFileInDir(ctx.outDir, file, formatEnumFile(r, ddl));
    ctx.meta.object_counts.enums++;
  }
}
