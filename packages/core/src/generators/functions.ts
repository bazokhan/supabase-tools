import { snapshotFileHeader } from "@sbtools/sdk";

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
  return (
    snapshotFileHeader({
      objectType: "function definition",
      headers: {
        Schema: row.schema,
        Function: `${row.name}(${row.identity_args})`,
      },
    }) + row.ddl + "\n"
  );
}
