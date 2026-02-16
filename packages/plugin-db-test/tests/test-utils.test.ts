import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { discoverTestFiles, checkBackslashCommands, extractEchoMarkers, processSqlFile } from "../src/test-utils.js";

describe("checkBackslashCommands", () => {
  it("returns empty array when no backslash commands", () => {
    expect(checkBackslashCommands("SELECT 1;")).toEqual([]);
    expect(checkBackslashCommands("-- \\echo skipped\nSELECT 1;")).toEqual([]);
  });

  it("detects unprocessed \\i commands", () => {
    const problems = checkBackslashCommands("\\i somefile.sql");
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toContain("\\i");
  });

  it("ignores comments", () => {
    expect(checkBackslashCommands("-- \\i commented out")).toEqual([]);
  });
});

describe("extractEchoMarkers", () => {
  it("extracts echo content and returns clean SQL", () => {
    const sql = "SELECT 1;\n-- ECHO: Hello World\nSELECT 2;";
    const { cleanSql, echoes } = extractEchoMarkers(sql);
    expect(echoes).toEqual(["Hello World"]);
    expect(cleanSql).not.toContain("ECHO");
    expect(cleanSql).toContain("SELECT 1");
    expect(cleanSql).toContain("SELECT 2");
  });

  it("returns empty echoes when none", () => {
    const { cleanSql, echoes } = extractEchoMarkers("SELECT 1;");
    expect(echoes).toEqual([]);
    expect(cleanSql).toBe("SELECT 1;");
  });
});

describe("discoverTestFiles", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sbt-test-"));
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty when dir does not exist", () => {
    expect(discoverTestFiles(path.join(tmpDir, "nonexistent"))).toEqual([]);
  });

  it("discovers .sql files recursively", async () => {
    await fs.promises.mkdir(path.join(tmpDir, "a"), { recursive: true });
    await fs.promises.writeFile(path.join(tmpDir, "a", "test_foo.sql"), "");
    await fs.promises.writeFile(path.join(tmpDir, "a", "test_bar.sql"), "");
    const files = discoverTestFiles(tmpDir);
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.endsWith("test_foo.sql"))).toBe(true);
    expect(files.some((f) => f.endsWith("test_bar.sql"))).toBe(true);
  });
});

describe("processSqlFile", () => {
  it("converts \\echo to comment", () => {
    const result = processSqlFile("\\echo Hello", "/tmp");
    expect(result).toContain("-- ECHO: Hello");
  });

  it("strips \\set commands", () => {
    const result = processSqlFile("\\set VAR value\nSELECT 1;", "/tmp");
    expect(result).not.toContain("\\set");
    expect(result).toContain("SELECT 1");
  });
});
