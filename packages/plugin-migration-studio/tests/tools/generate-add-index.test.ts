/**
 * Tests for generate-add-index tool.
 */
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { PluginContext } from "@sbtools/sdk";
import { runAddIndex, buildAddIndexSql } from "../../src/tools/generate-add-index.js";

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-add-index-test-"));
  const sbtDataDir = path.join(dir, ".sbt");
  const migrationsDir = path.join(dir, "supabase", "migrations");
  fs.mkdirSync(sbtDataDir, { recursive: true });
  fs.mkdirSync(migrationsDir, { recursive: true });
  return {
    ctx: {
      projectRoot: dir,
      sbtDataDir,
      pluginConfig: {},
      paths: { migrations: migrationsDir },
    } as unknown as PluginContext,
    migrationsDir,
  };
}

describe("buildAddIndexSql", () => {
  it("generates basic btree index with auto-generated name", () => {
    const sql = buildAddIndexSql({
      entityId: "public.users",
      index: { columns: ["email"] },
    });

    expect(sql).toContain("CREATE INDEX users_email_idx");
    expect(sql).toContain("ON public.users");
    expect(sql).toContain("USING btree");
    expect(sql).toContain("(email)");
    expect(sql).not.toContain("UNIQUE");
    expect(sql).not.toContain("WHERE");
  });

  it("generates UNIQUE index", () => {
    const sql = buildAddIndexSql({
      entityId: "public.users",
      index: { columns: ["email"], unique: true },
    });

    expect(sql).toContain("CREATE UNIQUE INDEX");
  });

  it("uses custom index name when provided", () => {
    const sql = buildAddIndexSql({
      entityId: "public.users",
      index: { name: "my_custom_idx", columns: ["email"] },
    });

    expect(sql).toContain("CREATE INDEX my_custom_idx");
  });

  it("generates partial index with WHERE clause", () => {
    const sql = buildAddIndexSql({
      entityId: "public.orders",
      index: {
        columns: ["status", "created_at"],
        where: "deleted_at IS NULL",
      },
    });

    expect(sql).toContain("WHERE deleted_at IS NULL");
    expect(sql).toContain("(status, created_at)");
  });

  it("generates GIN index for JSON columns", () => {
    const sql = buildAddIndexSql({
      entityId: "public.documents",
      index: { columns: ["content"], method: "gin" },
    });

    expect(sql).toContain("USING gin");
  });

  it("generates multi-column index with auto-name", () => {
    const sql = buildAddIndexSql({
      entityId: "public.orders",
      index: { columns: ["user_id", "status"] },
    });

    expect(sql).toContain("CREATE INDEX orders_user_id_status_idx");
    expect(sql).toContain("(user_id, status)");
  });

  it("handles entity ID without schema prefix", () => {
    const sql = buildAddIndexSql({
      entityId: "users",
      index: { columns: ["name"] },
    });

    expect(sql).toContain("ON public.users");
  });
});

describe("runAddIndex", () => {
  it("writes migration file and returns sql and filename", async () => {
    const { ctx, migrationsDir } = makeTempCtx();

    const result = await runAddIndex(ctx, {
      entityId: "public.users",
      index: { columns: ["email"], unique: true },
    });

    expect(result.filename).toMatch(/^\d+_add_index_users_email\.sql$/);
    const filePath = path.join(migrationsDir, result.filename);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toBe(result.sql + "\n");
  });

  it("works without intent graph", async () => {
    const { ctx } = makeTempCtx();
    const result = await runAddIndex(ctx, {
      entityId: "public.posts",
      index: { columns: ["title"] },
    });

    expect(result.sql).toContain("CREATE INDEX");
  });
});
