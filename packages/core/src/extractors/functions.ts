import type { Client } from "pg";
import type { SnapshotContext } from "@sbtools/sdk";
import { safeName, safeFileName, writeFileInDir } from "@sbtools/sdk";
import { formatFunctionFile } from "../generators/index.js";

/**
 * Extracts function definitions, writes one file per function, updates meta.object_counts.functions.
 *
 * @param client - Connected Postgres client.
 * @param ctx - Snapshot context (outDir, schemaFilterNsp, meta).
 */
export async function extractFunctions(
  client: Client,
  ctx: SnapshotContext
): Promise<void> {
  const res = await client.query(
    `
    SELECT
      n.nspname AS schema,
      p.proname AS name,
      pg_get_function_identity_arguments(p.oid) AS identity_args,
      pg_get_functiondef(p.oid) AS ddl
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      AND n.nspname NOT LIKE 'pg_temp_%'
      AND n.nspname NOT LIKE 'pg_toast_temp_%'
      ${ctx.schemaFilterNsp.clause}
    ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid);
  `,
    ctx.schemaFilterNsp.params
  );

  for (const r of res.rows as { schema: string; name: string; identity_args: string; ddl: string }[]) {
    const baseFileName = `functions/${safeName(r.schema)}.${safeName(r.name)}.sql`;
    const file = safeFileName(baseFileName);
    writeFileInDir(ctx.outDir, file, formatFunctionFile(r));
    ctx.meta.object_counts.functions++;
  }
}
