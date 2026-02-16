import { snapshotFileHeader } from "@sbtools/sdk";

/**
 * Builds the full file content for a trigger snapshot.
 *
 * @param row - Row with schema, table_name, trigger_name, ddl from pg_trigger.
 * @returns Content string to write.
 */
export function formatTriggerFile(row: {
  schema: string;
  table_name: string;
  trigger_name: string;
  ddl: string;
}): string {
  return (
    snapshotFileHeader({
      objectType: "trigger definition",
      headers: {
        Schema: row.schema,
        Table: row.table_name,
        Trigger: row.trigger_name,
      },
    }) + row.ddl + ";\n"
  );
}
