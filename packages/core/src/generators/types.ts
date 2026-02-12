/**
 * Builds the full file content for a custom type (composite or domain) snapshot.
 *
 * @param row - Row with schema, name, type_kind.
 * @param ddl - Prebuilt CREATE TYPE or CREATE DOMAIN statement.
 * @returns Content string to write.
 */
export function formatTypeFile(
  row: { schema: string; name: string; type_kind: string },
  ddl: string
): string {
  return `-- GENERATED: current type definition
-- Schema: ${row.schema}
-- Type: ${row.name} (${row.type_kind})
-- Do not edit manually. Regenerate via: npm run db:snapshot

${ddl}
`;
}
