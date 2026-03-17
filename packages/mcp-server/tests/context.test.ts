import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildContext } from "../src/context.js";

describe("buildContext", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-ctx-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("uses default paths when no config file exists", () => {
    const ctx = buildContext(tmpDir);
    expect(ctx.projectRoot).toBe(tmpDir);
    expect(ctx.sbtDataDir).toBe(path.join(tmpDir, ".sbt"));
    expect(ctx.artifactsDir).toBe(path.join(tmpDir, ".sbt", "artifacts"));
    expect(ctx.paths.migrations).toBe(path.join(tmpDir, "supabase", "migrations"));
    expect(ctx.paths.snapshot).toBe(path.join(tmpDir, ".sbt", "snapshot"));
    expect(ctx.paths.docsOutput).toBe(path.join(tmpDir, ".sbt", "docs"));
    expect(ctx.paths.functions).toBe(path.join(tmpDir, "supabase", "functions"));
    expect(ctx.apiUrl).toBe("http://localhost:54321");
    expect(ctx.pluginConfig).toEqual({});
  });

  it("reads paths and api.url from config file", () => {
    const config = {
      paths: { migrations: "db/migrations", functions: "db/functions" },
      api: { url: "http://localhost:9000" },
    };
    fs.writeFileSync(path.join(tmpDir, "supabase-tools.config.json"), JSON.stringify(config));

    const ctx = buildContext(tmpDir);
    expect(ctx.projectRoot).toBe(tmpDir);
    expect(ctx.paths.migrations).toBe(path.join(tmpDir, "db", "migrations"));
    expect(ctx.paths.functions).toBe(path.join(tmpDir, "db", "functions"));
    expect(ctx.apiUrl).toBe("http://localhost:9000");
  });

  it("uses defaults for config fields that are omitted", () => {
    const config = { api: { url: "http://custom:8888" } };
    fs.writeFileSync(path.join(tmpDir, "supabase-tools.config.json"), JSON.stringify(config));

    const ctx = buildContext(tmpDir);
    expect(ctx.apiUrl).toBe("http://custom:8888");
    expect(ctx.paths.migrations).toBe(path.join(tmpDir, "supabase", "migrations"));
    expect(ctx.paths.snapshot).toBe(path.join(tmpDir, ".sbt", "snapshot"));
  });

  it("walks up from a subdirectory to find the config file", () => {
    const config = { api: { url: "http://found-via-walk:1234" } };
    fs.writeFileSync(path.join(tmpDir, "supabase-tools.config.json"), JSON.stringify(config));

    const subDir = path.join(tmpDir, "src", "deep", "nested");
    fs.mkdirSync(subDir, { recursive: true });

    const ctx = buildContext(subDir);
    expect(ctx.projectRoot).toBe(tmpDir);
    expect(ctx.apiUrl).toBe("http://found-via-walk:1234");
  });

  it("falls back to the supplied cwd when no config is found", () => {
    // tmpDir has no config, and no parent has one (tmpDir is already isolated)
    const ctx = buildContext(tmpDir);
    expect(ctx.projectRoot).toBe(tmpDir);
  });

  it("resolves absolute config paths as-is", () => {
    const absDir = path.join(tmpDir, "absolute-migrations");
    const config = { paths: { migrations: absDir } };
    fs.writeFileSync(path.join(tmpDir, "supabase-tools.config.json"), JSON.stringify(config));

    const ctx = buildContext(tmpDir);
    expect(ctx.paths.migrations).toBe(absDir);
  });

  it("tolerates a malformed config file and uses defaults", () => {
    fs.writeFileSync(path.join(tmpDir, "supabase-tools.config.json"), "not valid json {{");

    const ctx = buildContext(tmpDir);
    expect(ctx.projectRoot).toBe(tmpDir);
    expect(ctx.apiUrl).toBe("http://localhost:54321");
  });
});
