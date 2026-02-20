/**
 * Tests for generate-create-rpc tool.
 */
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { PluginContext } from "@sbtools/sdk";
import { runCreateRpc } from "../../src/tools/generate-create-rpc.js";

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-create-rpc-test-"));
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

describe("runCreateRpc", () => {
  it("forces schema to public and writes create_rpc filename", async () => {
    const { ctx, migrationsDir } = makeTempCtx();

    const result = await runCreateRpc(ctx, {
      name: "get_user_profile",
      params: [{ name: "user_id", type: "uuid" }],
      returnType: "TABLE(id uuid, email text)",
      language: "sql",
      body: "SELECT id, email FROM users WHERE id = user_id;",
    });

    expect(result.sql).toContain("public.get_user_profile");
    expect(result.sql).not.toContain("schema.");
    expect(result.filename).toMatch(/^\d+_create_rpc_get_user_profile\.sql$/);

    const filePath = path.join(migrationsDir, result.filename);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("generates correct CREATE OR REPLACE FUNCTION SQL", async () => {
    const { ctx } = makeTempCtx();

    const result = await runCreateRpc(ctx, {
      name: "hello",
      params: [],
      returnType: "text",
      language: "sql",
      body: "SELECT 'hello';",
    });

    expect(result.sql).toContain("CREATE OR REPLACE FUNCTION");
    expect(result.sql).toContain("public.hello()");
    expect(result.sql).toContain("RETURNS text");
    expect(result.sql).toContain("SELECT 'hello'");
  });
});
