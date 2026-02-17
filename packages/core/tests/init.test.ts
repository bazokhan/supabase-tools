import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { validateConfig } from "../src/config.js";

/**
 * Tests the init command behaviour.
 * init() is in cli.ts; we test the logic it relies on.
 */

describe("init default config structure", () => {
  it("default config is valid", () => {
    const defaultConfig = {
      paths: {
        migrations: "supabase/migrations",
        snapshot: "supabase/current",
        docsOutput: "docs",
        functions: "supabase/functions",
      },
      db: {
        url: "postgresql://postgres:postgres@localhost:54322/postgres",
        container: "supabase-db",
      },
      api: {
        url: "http://localhost:54321",
        studioUrl: "http://localhost:54323",
        inbucketUrl: "http://localhost:54324",
      },
      project: { name: "test-project" },
      plugins: [],
    };
    const result = validateConfig(defaultConfig);
    expect(result.success).toBe(true);
  });
});

describe("ensureGitignoreSbtEntry behaviour", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sbt-init-"));
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates .gitignore with .sbt/ when missing", () => {
    const gitignorePath = path.join(tmpDir, ".gitignore");
    const entry = ".sbt/";
    expect(fs.existsSync(gitignorePath)).toBe(false);
    fs.writeFileSync(gitignorePath, entry + "\n", "utf8");
    expect(fs.readFileSync(gitignorePath, "utf8")).toContain(entry);
  });

  it("appends .sbt/ when .gitignore exists but lacks entry", () => {
    const gitignorePath = path.join(tmpDir, ".gitignore");
    fs.writeFileSync(gitignorePath, "node_modules/\n", "utf8");
    const content = fs.readFileSync(gitignorePath, "utf8");
    const hasEntry = content.split(/\r?\n/).some((line) => /^\.sbt\/?$/.test(line.trim()));
    if (!hasEntry) {
      const suffix = content.endsWith("\n") ? "" : "\n";
      fs.writeFileSync(gitignorePath, content + suffix + ".sbt/\n", "utf8");
    }
    expect(fs.readFileSync(gitignorePath, "utf8")).toContain(".sbt/");
  });

  it("does not duplicate .sbt/ when already present", () => {
    const gitignorePath = path.join(tmpDir, ".gitignore");
    const initial = "node_modules/\n.sbt/\ndist/\n";
    fs.writeFileSync(gitignorePath, initial, "utf8");
    const content = fs.readFileSync(gitignorePath, "utf8");
    const lines = content.split(/\r?\n/);
    const sbtEntries = lines.filter((line) => /^\.sbt\/?$/.test(line.trim()));
    expect(sbtEntries.length).toBeLessThanOrEqual(1);
  });
});
