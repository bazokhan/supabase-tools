/**
 * Filesystem migration file scanner.
 */
import fs from "node:fs";
import path from "node:path";
import type { MigrationFile } from "./types.js";

/** Regex to extract leading YYYYMMDDHHMMSS timestamp prefix from filename. */
const TIMESTAMP_RE = /^(\d{14,})_/;

/**
 * Extract timestamp prefix from migration filename (e.g. 20240101120000_foo.sql).
 */
export function parseTimestampPrefix(filename: string): string | null {
  const m = filename.match(TIMESTAMP_RE);
  return m ? m[1] : null;
}

/**
 * Scan migration files from directory — .sql files, sorted alphabetically,
 * with size and mtime from fs.statSync.
 */
export function scanMigrationFiles(dir: string): MigrationFile[] {
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
