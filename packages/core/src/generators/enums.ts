/**
 * Builds the full file content for an enum snapshot.
 *
 * @param row - Row with schema, name.
 * @param ddl - Prebuilt CREATE TYPE ... AS ENUM (...) statement.
 * @returns Content string to write.
 */
export function formatEnumFile(
  row: { schema: string; name: string },
  ddl: string
): string {
  return `-- GENERATED: current enum definition
-- Schema: ${row.schema}
-- Enum: ${row.name}
-- Do not edit manually. Regenerate via: npm run db:snapshot

${ddl}
`;
}
