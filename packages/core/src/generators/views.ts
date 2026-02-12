/**
 * Builds the full file content for a view snapshot.
 *
 * @param row - Row with schema, name, definition from pg_views.
 * @returns Content string to write.
 */
export function formatViewFile(row: {
  schema: string;
  name: string;
  definition: string;
}): string {
  return `-- GENERATED: current view definition
-- Schema: ${row.schema}
-- View: ${row.name}
-- Do not edit manually. Regenerate via: npm run db:snapshot

CREATE OR REPLACE VIEW ${row.schema}.${row.name} AS
${row.definition}
;
`;
}

/**
 * Builds the full file content for a materialized view snapshot.
 *
 * @param row - Row with schema, name, definition from pg_matviews.
 * @returns Content string to write.
 */
export function formatMaterializedViewFile(row: {
  schema: string;
  name: string;
  definition: string;
}): string {
  return `-- GENERATED: current materialized view definition
-- Schema: ${row.schema}
-- Materialized View: ${row.name}
-- Do not edit manually. Regenerate via: npm run db:snapshot

CREATE MATERIALIZED VIEW IF NOT EXISTS ${row.schema}.${row.name} AS
${row.definition}
;
`;
}
