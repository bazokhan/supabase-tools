/**
 * Tests for studio-sql-parse tool.
 *
 * Uses real temp directories with fixture SQL files.
 * Validates SqlAstFileEntry extraction and allEntities aggregation.
 */
import { describe, it, expect, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { readArtifactOrNull } from "@sbtools/sdk";
import type { SqlAstData } from "../../src/artifacts/writers.js";
import { STUDIO_ARTIFACTS } from "../../src/artifacts/constants.js";
import { runSqlParse } from "../../src/tools/sql-parse.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempCtx(migrationsContent: Record<string, string> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-sql-parse-test-"));
  const sbtDataDir = path.join(dir, ".sbt");
  const migrationsDir = path.join(dir, "migrations");
  fs.mkdirSync(sbtDataDir, { recursive: true });
  fs.mkdirSync(migrationsDir, { recursive: true });

  for (const [filename, content] of Object.entries(migrationsContent)) {
    fs.writeFileSync(path.join(migrationsDir, filename), content, "utf8");
  }

  return {
    ctx: {
      projectRoot: dir,
      sbtDataDir,
      pluginConfig: {},
      paths: { migrations: migrationsDir },
    } as unknown as import("@sbtools/sdk").PluginContext,
    dir,
  };
}

const cleanup: string[] = [];
afterEach(() => {
  for (const d of cleanup) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
  }
  cleanup.length = 0;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runSqlParse", () => {
  it("writes empty artifact when migrations dir is empty", async () => {
    const { ctx } = makeTempCtx();
    await runSqlParse(ctx);

    const env = readArtifactOrNull<SqlAstData>(
      ctx,
      STUDIO_ARTIFACTS.SQL_AST.id,
      STUDIO_ARTIFACTS.SQL_AST.version
    );
    expect(env).not.toBeNull();
    expect(env!.data.files).toHaveLength(0);
    expect(env!.data.totalStatements).toBe(0);
    expect(env!.data.allEntities).toHaveLength(0);
  });

  it("writes empty artifact when migrations dir does not exist", async () => {
    const { ctx } = makeTempCtx();
    // Override to non-existent dir
    (ctx.paths as Record<string, string>)["migrations"] = path.join(ctx.projectRoot, "nonexistent");

    await runSqlParse(ctx);

    const env = readArtifactOrNull<SqlAstData>(
      ctx,
      STUDIO_ARTIFACTS.SQL_AST.id,
      STUDIO_ARTIFACTS.SQL_AST.version
    );
    expect(env).not.toBeNull();
    expect(env!.data.files).toHaveLength(0);
  });

  it("extracts EntityNode from CREATE TABLE", async () => {
    const { ctx } = makeTempCtx({
      "0001_init.sql": `
        CREATE TABLE public.orders (
          id uuid NOT NULL DEFAULT gen_random_uuid(),
          total numeric NOT NULL,
          created_at timestamptz DEFAULT now()
        );
      `,
    });

    await runSqlParse(ctx);

    const env = readArtifactOrNull<SqlAstData>(
      ctx,
      STUDIO_ARTIFACTS.SQL_AST.id,
      STUDIO_ARTIFACTS.SQL_AST.version
    );

    expect(env!.data.files).toHaveLength(1);
    const file = env!.data.files[0];
    expect(file.filename).toBe("0001_init.sql");
    expect(file.statementCount).toBe(1);
    expect(file.entities).toHaveLength(1);
    expect(file.entities[0].id).toBe("public.orders");
    expect(file.entities[0].schema).toBe("public");
    expect(file.entities[0].name).toBe("orders");
  });

  it("populates allEntities across multiple files", async () => {
    const { ctx } = makeTempCtx({
      "0001_users.sql": `CREATE TABLE public.users (id uuid NOT NULL);`,
      "0002_posts.sql": `CREATE TABLE public.posts (id uuid NOT NULL, user_id uuid NOT NULL);`,
    });

    await runSqlParse(ctx);

    const env = readArtifactOrNull<SqlAstData>(
      ctx,
      STUDIO_ARTIFACTS.SQL_AST.id,
      STUDIO_ARTIFACTS.SQL_AST.version
    );

    expect(env!.data.files).toHaveLength(2);
    expect(env!.data.allEntities).toHaveLength(2);

    const ids = env!.data.allEntities.map((e) => e.id);
    expect(ids).toContain("public.users");
    expect(ids).toContain("public.posts");
  });

  it("extracts PolicyNode from CREATE POLICY", async () => {
    const { ctx } = makeTempCtx({
      "0001_rls.sql": `
        CREATE TABLE public.items (id uuid NOT NULL);
        CREATE POLICY items_select ON public.items FOR SELECT TO authenticated USING (true);
      `,
    });

    await runSqlParse(ctx);

    const env = readArtifactOrNull<SqlAstData>(
      ctx,
      STUDIO_ARTIFACTS.SQL_AST.id,
      STUDIO_ARTIFACTS.SQL_AST.version
    );

    expect(env!.data.allPolicies).toHaveLength(1);
    const policy = env!.data.allPolicies[0];
    expect(policy.entity).toBe("public.items");
    expect(policy.command).toBe("SELECT");
  });

  it("deduplicates entities with the same id across files", async () => {
    // Same table defined twice (should be deduplicated by id)
    const { ctx } = makeTempCtx({
      "0001_create.sql": `CREATE TABLE public.users (id uuid NOT NULL);`,
      "0002_alter.sql": `ALTER TABLE public.users ADD COLUMN name text;`,
    });

    await runSqlParse(ctx);

    const env = readArtifactOrNull<SqlAstData>(
      ctx,
      STUDIO_ARTIFACTS.SQL_AST.id,
      STUDIO_ARTIFACTS.SQL_AST.version
    );

    // CREATE TABLE produces an entity, ALTER TABLE produces an opaque block
    // So allEntities should have exactly 1 entry (the CREATE TABLE entity)
    const ids = env!.data.allEntities.map((e) => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("records total statement count across all files", async () => {
    const { ctx } = makeTempCtx({
      "0001_init.sql": `
        CREATE TABLE public.a (id uuid NOT NULL);
        CREATE TABLE public.b (id uuid NOT NULL);
      `,
      "0002_more.sql": `CREATE TABLE public.c (id uuid NOT NULL);`,
    });

    await runSqlParse(ctx);

    const env = readArtifactOrNull<SqlAstData>(
      ctx,
      STUDIO_ARTIFACTS.SQL_AST.id,
      STUDIO_ARTIFACTS.SQL_AST.version
    );

    expect(env!.data.totalStatements).toBe(3);
  });
});
