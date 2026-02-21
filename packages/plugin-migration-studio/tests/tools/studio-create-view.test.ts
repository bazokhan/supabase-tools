/**
 * Tests for generate-create-view tool.
 */
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { PluginContext } from "@sbtools/sdk";
import { runCreateView } from "../../src/tools/core/studio-create-view.core.js";

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-create-view-test-"));
  const sbtDataDir = path.join(dir, ".sbt");
  fs.mkdirSync(sbtDataDir, { recursive: true });
  return {
    ctx: {
      projectRoot: dir,
      sbtDataDir,
      pluginConfig: {},
      paths: { migrations: path.join(dir, "supabase", "migrations") },
    } as unknown as PluginContext,
  };
}

describe("runCreateView", () => {
  it("generates CREATE OR REPLACE VIEW SQL", async () => {
    const { ctx } = makeTempCtx();
    const result = await runCreateView(ctx, {
      schema: "public",
      name: "active_users",
      query: "SELECT id, email FROM users WHERE active = true",
    });
    expect(result.sql).toContain("CREATE OR REPLACE VIEW public.active_users AS");
    expect(result.sql).toContain("SELECT id, email FROM users WHERE active = true");
  });

  it("writes migration file to disk", async () => {
    const { ctx } = makeTempCtx();
    const result = await runCreateView(ctx, {
      schema: "public",
      name: "recent_orders",
      query: "SELECT * FROM orders ORDER BY created_at DESC LIMIT 100",
    });
    const filePath = path.join(ctx.paths.migrations, result.filename);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain("recent_orders");
  });

  it("filename has create_view prefix", async () => {
    const { ctx } = makeTempCtx();
    const result = await runCreateView(ctx, { schema: "public", name: "my_view", query: "SELECT 1" });
    expect(result.filename).toMatch(/^\d+_create_view_my_view\.sql$/);
  });

  it("does not require an intent graph artifact", async () => {
    const { ctx } = makeTempCtx();
    await expect(
      runCreateView(ctx, { schema: "public", name: "simple_view", query: "SELECT 1 AS num" })
    ).resolves.toBeDefined();
  });

  it("creates migrations directory if it does not exist", async () => {
    const { ctx } = makeTempCtx();
    expect(fs.existsSync(ctx.paths.migrations)).toBe(false);
    await runCreateView(ctx, { schema: "public", name: "v", query: "SELECT 1" });
    expect(fs.existsSync(ctx.paths.migrations)).toBe(true);
  });

  it("throws INVALID_INPUT when schema is empty", async () => {
    const { ctx } = makeTempCtx();
    await expect(runCreateView(ctx, { schema: "", name: "v", query: "SELECT 1" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("throws INVALID_INPUT when name is empty", async () => {
    const { ctx } = makeTempCtx();
    await expect(runCreateView(ctx, { schema: "public", name: "", query: "SELECT 1" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("throws INVALID_INPUT when query is empty", async () => {
    const { ctx } = makeTempCtx();
    await expect(runCreateView(ctx, { schema: "public", name: "v", query: "  " })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });
});


