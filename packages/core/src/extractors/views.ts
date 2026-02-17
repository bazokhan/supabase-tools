import type { Client } from "pg";
import type { SnapshotContext } from "@sbtools/sdk";
import { safeName, safeFileName, writeFileInDir } from "@sbtools/sdk";
import { formatViewFile, formatMaterializedViewFile } from "../generators/index.js";

/**
 * Extracts view definitions, writes one file per view, updates meta.object_counts.views.
 *
 * @param client - Connected Postgres client.
 * @param ctx - Snapshot context (outDir, schemaFilterSchemaname, meta).
 */
export async function extractViews(
  client: Client,
  ctx: SnapshotContext
): Promise<void> {
  const res = await client.query(
    `
    SELECT
      schemaname AS schema,
      viewname AS name,
      pg_get_viewdef((quote_ident(schemaname)||'.'||quote_ident(viewname))::regclass, true) AS definition
    FROM pg_views
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ${ctx.schemaFilterSchemaname.clause}
    ORDER BY schemaname, viewname;
  `,
    ctx.schemaFilterSchemaname.params
  );

  for (const r of res.rows as { schema: string; name: string; definition: string }[]) {
    const baseFileName = `views/${safeName(r.schema)}.${safeName(r.name)}.sql`;
    const file = safeFileName(baseFileName);
    writeFileInDir(ctx.outDir, file, formatViewFile(r));
    ctx.meta.object_counts.views++;
  }
}

/**
 * Extracts materialized view definitions, writes one file per materialized view, updates meta.object_counts.materialized_views.
 *
 * @param client - Connected Postgres client.
 * @param ctx - Snapshot context (outDir, schemaFilterSchemaname, meta).
 */
export async function extractMaterializedViews(
  client: Client,
  ctx: SnapshotContext
): Promise<void> {
  const res = await client.query(
    `
    SELECT
      schemaname AS schema,
      matviewname AS name,
      pg_get_viewdef((quote_ident(schemaname)||'.'||quote_ident(matviewname))::regclass, true) AS definition
    FROM pg_matviews
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ${ctx.schemaFilterSchemaname.clause}
    ORDER BY schemaname, matviewname;
  `,
    ctx.schemaFilterSchemaname.params
  );

  for (const r of res.rows as { schema: string; name: string; definition: string }[]) {
    const baseFileName = `views/${safeName(r.schema)}.${safeName(r.name)}.materialized.sql`;
    const file = safeFileName(baseFileName);
    writeFileInDir(ctx.outDir, file, formatMaterializedViewFile(r));
    ctx.meta.object_counts.materialized_views++;
  }
}
