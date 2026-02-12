import type { Client } from "pg";
import type { SnapshotContext } from "@sbtools/sdk";
import { safeName, safeFileName, writeFileInDir } from "@sbtools/sdk";
import { formatTriggerFile } from "../generators/index.js";

/**
 * Extracts trigger definitions, writes one file per trigger, updates meta.object_counts.triggers.
 *
 * @param client - Connected Postgres client.
 * @param ctx - Snapshot context (outDir, schemaFilterNsp, meta).
 */
export async function extractTriggers(
  client: Client,
  ctx: SnapshotContext
): Promise<void> {
  const res = await client.query(`
    SELECT
      n.nspname AS schema,
      c.relname AS table_name,
      t.tgname AS trigger_name,
      pg_get_triggerdef(t.oid, true) AS ddl
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      ${ctx.schemaFilterNsp}
    ORDER BY n.nspname, c.relname, t.tgname;
  `);

  for (const r of res.rows as { schema: string; table_name: string; trigger_name: string; ddl: string }[]) {
    const baseFileName = `triggers/${safeName(r.schema)}.${safeName(r.table_name)}.${safeName(r.trigger_name)}.sql`;
    const file = safeFileName(baseFileName);
    writeFileInDir(ctx.outDir, file, formatTriggerFile(r));
    ctx.meta.object_counts.triggers++;
  }
}
