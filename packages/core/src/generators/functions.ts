/**
 * Builds the full file content for a function snapshot.
 *
 * @param row - Row with schema, name, identity_args, ddl from pg_proc.
 * @returns Content string to write.
 */
export function formatFunctionFile(row: {
  schema: string;
  name: string;
  identity_args: string;
  ddl: string;
}): string {
  return `-- GENERATED: current function definition
-- Schema: ${row.schema}
-- Function: ${row.name}(${row.identity_args})
-- Do not edit manually. Regenerate via: npm run db:snapshot

${row.ddl}
`;
}
