import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { scanMigrationFiles, parseTimestampPrefix } from "@sbtools/sdk";

const TEMP = path.join(os.tmpdir(), `sbt-migration-scanner-test-${Date.now()}`);

describe("migration-scanner", () => {
  it("parseTimestampPrefix extracts timestamp", () => {
    expect(parseTimestampPrefix("20240101120000_foo.sql")).toBe("20240101120000");
    expect(parseTimestampPrefix("20240101120000.sql")).toBe(null);
  });

  it("scanMigrationFiles returns empty for missing dir", () => {
    expect(scanMigrationFiles("/nonexistent/path")).toEqual([]);
  });

  it("scanMigrationFiles returns sql files sorted", () => {
    fs.mkdirSync(TEMP, { recursive: true });
    fs.writeFileSync(path.join(TEMP, "20240101000000_a.sql"), "");
    fs.writeFileSync(path.join(TEMP, "20240102000000_b.sql"), "");
    try {
      const files = scanMigrationFiles(TEMP);
      expect(files).toHaveLength(2);
      expect(files[0].filename).toBe("20240101000000_a.sql");
      expect(files[1].filename).toBe("20240102000000_b.sql");
      expect(files[0].timestampPrefix).toBe("20240101000000");
    } finally {
      fs.rmSync(TEMP, { recursive: true, force: true });
    }
  });
});
