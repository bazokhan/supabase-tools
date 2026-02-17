import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  buildAuditResult,
  detectIssues,
  ISSUE_CODES,
} from "../src/auditor.js";
import { scanMigrationFiles } from "@sbtools/sdk";

describe("buildAuditResult", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sbt-audit-"));
    fs.mkdirSync(path.join(tmpDir, "migrations"), { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns audit result with applied and pending entries", () => {
    fs.writeFileSync(
      path.join(tmpDir, "migrations", "20240115000000_create_users.sql"),
      "CREATE TABLE users (id uuid);",
      "utf8"
    );
    const files = scanMigrationFiles(path.join(tmpDir, "migrations"));
    const applied = [
      { version: "20240115000000_create_users.sql", appliedAt: new Date() },
    ];
    const result = buildAuditResult({
      migrationsDir: path.join(tmpDir, "migrations"),
      files,
      applied,
      trackingTableExists: true,
      databaseReachable: true,
      schema: null,
    });
    expect(result.summary.total).toBe(1);
    expect(result.summary.applied).toBe(1);
    expect(result.summary.pending).toBe(0);
    expect(result.migrations).toHaveLength(1);
    expect(result.migrations[0].status).toBe("applied");
  });

  it("marks missing when applied in DB but not on disk", () => {
    const files: ReturnType<typeof scanMigrationFiles> = [];
    const applied = [
      { version: "20240115000000_orphan.sql", appliedAt: new Date() },
    ];
    const result = buildAuditResult({
      migrationsDir: path.join(tmpDir, "migrations"),
      files,
      applied,
      trackingTableExists: true,
      databaseReachable: true,
      schema: null,
    });
    expect(result.summary.missing).toBe(1);
    expect(result.migrations[0].status).toBe("missing");
  });
});

describe("detectIssues", () => {
  it("returns NO_TRACKING_TABLE when DB reachable but no table", () => {
    const issues = detectIssues(
      [],
      [],
      false,
      true
    );
    expect(issues.some((i) => i.code === ISSUE_CODES.NO_TRACKING_TABLE)).toBe(true);
  });

  it("returns MISSING_FILE when entries have status missing", () => {
    const issues = detectIssues(
      [
        {
          filename: "20240115000000_orphan.sql",
          status: "missing",
          timestampPrefix: "20240115000000",
          appliedAt: new Date(),
          sizeBytes: 0,
          fileModifiedAt: null,
          filePath: "",
        },
      ],
      [{ version: "20240115000000_orphan.sql", appliedAt: new Date() }],
      true,
      true
    );
    expect(issues.some((i) => i.code === ISSUE_CODES.MISSING_FILE)).toBe(true);
  });

  it("returns PENDING_MIGRATION when entries have status pending", () => {
    const issues = detectIssues(
      [
        {
          filename: "20240115000000_pending.sql",
          status: "pending",
          timestampPrefix: "20240115000000",
          appliedAt: null,
          sizeBytes: 100,
          fileModifiedAt: new Date(),
          filePath: "/some/path",
        },
      ],
      [],
      true,
      true
    );
    expect(issues.some((i) => i.code === ISSUE_CODES.PENDING_MIGRATION)).toBe(true);
  });
});
