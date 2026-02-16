/**
 * Re-export migration scanner from SDK for backward compatibility.
 * MigrationFile is compatible with MigrationFileInfo.
 */
export {
  scanMigrationFiles,
  parseTimestampPrefix,
} from "@sbtools/sdk";
