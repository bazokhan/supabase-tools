/**
 * Filesystem migration file scanner. Shared across migration-audit and migration-studio.
 */
import fs from "node:fs";
import path from "node:path";

/** Regex to extract leading YYYYMMDDHHMMSS timestamp prefix from filename. */
const TIMESTAMP_RE = /^(\d{14,})_/;

export interface MigrationFileInfo {
  filename: string;
  filePath: string;
  sizeBytes: number;
  modifiedAt: Date;
  timestampPrefix: string | null;
}

/** Extract timestamp prefix from migration filename (e.g. 20240101120000_foo.sql). */
export function parseTimestampPrefix(filename: string): string | null {
  const m = filename.match(TIMESTAMP_RE);
  return m ? m[1] : null;
}

/** Scan migration files from directory — .sql files, sorted alphabetically. */
export function scanMigrationFiles(dir: string): MigrationFileInfo[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir);
  const sqlFiles = entries
    .filter((name) => name.endsWith(".sql"))
    .sort();

  return sqlFiles.map((filename) => {
    const filePath = path.join(dir, filename);
    const stat = fs.statSync(filePath);
    return {
      filename,
      filePath,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime,
      timestampPrefix: parseTimestampPrefix(filename),
    };
  });
}
