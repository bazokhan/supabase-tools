/**
 * Tests for generate-add-function tool.
 */
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { PluginContext } from "@sbtools/sdk";
import { runAddFunction } from "../../src/tools/generate-add-function.js";

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-add-function-test-"));
  const migrationsDir = path.join(dir, "supabase", "migrations");
  fs.mkdirSync(migrationsDir, { recursive: true });
  return {
    ctx: {
      projectRoot: dir,
      sbtDataDir: path.join(dir, ".sbt"),
      pluginConfig: {},
      paths: { migrations: migrationsDir },
    } as unknown as PluginContext,
    migrationsDir,
  };
}

describe("runAddFunction", () => {
  it("generates CREATE OR REPLACE FUNCTION and writes migration file", async () => {
    const { ctx, migrationsDir } = makeTempCtx();

    const result = await runAddFunction(ctx, {
      schema: "public",
      name: "clean_old_logs",
      params: [],
      returnType: "void",
      language: "plpgsql",
      body: "DELETE FROM logs WHERE created_at < now() - interval '30 days';",
    });

    expect(result.sql).toContain("CREATE OR REPLACE FUNCTION");
    expect(result.sql).toContain("public.clean_old_logs");
    expect(result.sql).toContain("RETURNS void");
    expect(result.sql).toContain("LANGUAGE plpgsql");
    expect(result.sql).toContain("SECURITY INVOKER");
    expect(result.sql).toContain("DELETE FROM logs");
    expect(result.filename).toMatch(/^\d+_add_function_clean_old_logs\.sql$/);

    const filePath = path.join(migrationsDir, result.filename);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toBe(result.sql + "\n");
  });

  it("includes params in signature", async () => {
    const { ctx } = makeTempCtx();

    const result = await runAddFunction(ctx, {
      schema: "public",
      name: "get_user",
      params: [{ name: "user_id", type: "uuid" }],
      returnType: "jsonb",
      language: "sql",
      body: "SELECT row_to_json(u) FROM users u WHERE id = user_id;",
    });

    expect(result.sql).toContain("user_id uuid");
  });

  it("supports SECURITY DEFINER", async () => {
    const { ctx } = makeTempCtx();

    const result = await runAddFunction(ctx, {
      schema: "public",
      name: "admin_only",
      params: [],
      returnType: "void",
      language: "plpgsql",
      body: "NULL;",
      security: "definer",
    });

    expect(result.sql).toContain("SECURITY DEFINER");
  });
});
