import { snapshotFileHeader } from "@sbtools/sdk";

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
  return (
    snapshotFileHeader({
      objectType: "enum definition",
      headers: { Schema: row.schema, Enum: row.name },
    }) + ddl + "\n"
  );
}
