import type { Client } from "pg";
import type { SnapshotContext, PolicyRow } from "@sbtools/sdk";
import { safeName, safeFileName, writeFileInDir } from "@sbtools/sdk";
import { formatPoliciesFile } from "../generators/index.js";

/**
 * Extracts RLS policies, groups by table, writes one file per table, updates meta.object_counts.policies.
 *
 * @param client - Connected Postgres client.
 * @param ctx - Snapshot context (outDir, schemaFilterSchemaname, meta).
 */
export async function extractPolicies(
  client: Client,
  ctx: SnapshotContext
): Promise<void> {
  const res = await client.query(`
    SELECT
      schemaname AS schema,
      tablename AS table_name,
      policyname AS policy_name,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ${ctx.schemaFilterSchemaname}
    ORDER BY schemaname, tablename, policyname;
  `);

  const rows = res.rows as PolicyRow[];
  const byTable = new Map<string, PolicyRow[]>();
  for (const r of rows) {
    const key = `${r.schema}.${r.table_name}`;
    if (!byTable.has(key)) byTable.set(key, []);
    byTable.get(key)!.push(r);
  }

  for (const [key, policies] of byTable.entries()) {
    const [schema, table] = key.split(".");
    const baseFileName = `policies/${safeName(schema)}.${safeName(table)}.sql`;
    const file = safeFileName(baseFileName);
    writeFileInDir(ctx.outDir, file, formatPoliciesFile(schema, table, policies));
    ctx.meta.object_counts.policies += policies.length;
  }
}
