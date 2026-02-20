/**
 * Tests for generate-create-table tool.
 */
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { writeArtifact, readArtifactOrNull } from "@sbtools/sdk";
import type { EntityNode, IntentGraph, PluginContext } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../src/artifacts/constants.js";
import { runCreateTable, buildCreateTableSql } from "../../src/tools/generate-create-table.js";

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-create-table-test-"));
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

function writeIntentGraph(ctx: PluginContext, entities: EntityNode[]) {
  const graph: IntentGraph = {
    version: "1.0.0",
    mode: "brownfield-managed",
    entities,
    views: [],
    functions: [],
    triggers: [],
    policies: [],
    endpoints: [],
    infrastructure: [],
    opaqueBlocks: [],
    managedScope: { schemas: { public: "managed" }, explicitExclusions: [] },
  };
  writeArtifact(ctx, {
    id: STUDIO_ARTIFACTS.INTENT_GRAPH.id,
    version: STUDIO_ARTIFACTS.INTENT_GRAPH.version,
    producer: "test",
    generatedAt: new Date().toISOString(),
    data: graph,
  });
}

describe("buildCreateTableSql", () => {
  it("generates CREATE TABLE with single PK and RLS", () => {
    const sql = buildCreateTableSql({
      schema: "public",
      name: "users",
      columns: [
        { name: "id", type: "uuid", nullable: false, identity: true, primaryKey: true },
        { name: "email", type: "text", nullable: false },
        { name: "created_at", type: "timestamptz", nullable: true, default: "now()" },
      ],
      enableRls: true,
    });

    expect(sql).toContain("CREATE TABLE public.users");
    expect(sql).toContain("id uuid PRIMARY KEY DEFAULT gen_random_uuid()");
    expect(sql).toContain("email text NOT NULL");
    expect(sql).toContain("created_at timestamptz DEFAULT now()");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  });

  it("skips RLS when enableRls is false", () => {
    const sql = buildCreateTableSql({
      schema: "private",
      name: "audit_log",
      columns: [{ name: "id", type: "bigint", nullable: false, identity: true }],
      enableRls: false,
    });

    expect(sql).not.toContain("ROW LEVEL SECURITY");
    expect(sql).toContain("CREATE TABLE private.audit_log");
  });

  it("defaults to enableRls: true when not specified", () => {
    const sql = buildCreateTableSql({
      schema: "public",
      name: "items",
      columns: [{ name: "id", type: "uuid", nullable: false }],
    });

    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  });

  it("generates composite primary key as separate constraint", () => {
    const sql = buildCreateTableSql({
      schema: "public",
      name: "order_items",
      columns: [
        { name: "order_id", type: "uuid", nullable: false },
        { name: "product_id", type: "uuid", nullable: false },
        { name: "quantity", type: "int", nullable: false },
      ],
      primaryKey: ["order_id", "product_id"],
    });

    expect(sql).toContain("order_id uuid NOT NULL");
    expect(sql).toContain("product_id uuid NOT NULL");
    expect(sql).toContain("PRIMARY KEY (order_id, product_id)");
    // Composite PK: NOT NULL stays on the columns (no inline PRIMARY KEY)
    expect(sql).not.toMatch(/order_id uuid PRIMARY KEY/);
  });

  it("uses explicit top-level primaryKey over column-level flag", () => {
    const sql = buildCreateTableSql({
      schema: "public",
      name: "test",
      columns: [
        { name: "uid", type: "uuid", nullable: false, primaryKey: true },
        { name: "code", type: "text", nullable: false },
      ],
      primaryKey: ["code"],
    });

    expect(sql).toContain("code text PRIMARY KEY");
    expect(sql).not.toMatch(/uid uuid PRIMARY KEY/);
  });

  it("uses GENERATED ALWAYS AS IDENTITY for non-uuid identity column", () => {
    const sql = buildCreateTableSql({
      schema: "public",
      name: "counters",
      columns: [{ name: "id", type: "bigint", nullable: false, identity: true, primaryKey: true }],
    });

    expect(sql).toContain("id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY");
  });

  it("falls back to 'id' column as primary key when no PK specified", () => {
    const sql = buildCreateTableSql({
      schema: "public",
      name: "things",
      columns: [
        { name: "id", type: "uuid", nullable: false },
        { name: "label", type: "text", nullable: true },
      ],
    });

    expect(sql).toContain("id uuid PRIMARY KEY");
  });
});

describe("runCreateTable", () => {
  it("writes migration file and returns correct sql and filename", async () => {
    const { ctx, migrationsDir } = makeTempCtx();

    const result = await runCreateTable(ctx, {
      schema: "public",
      name: "users",
      columns: [
        { name: "id", type: "uuid", nullable: false, identity: true, primaryKey: true },
        { name: "email", type: "text", nullable: false },
      ],
      enableRls: true,
    });

    expect(result.filename).toMatch(/^\d+_create_table_public_users\.sql$/);
    const filePath = path.join(migrationsDir, result.filename);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toBe(result.sql + "\n");
  });

  it("works without an intent graph (greenfield case)", async () => {
    const { ctx } = makeTempCtx();
    // No intent graph written — should succeed without error

    const result = await runCreateTable(ctx, {
      schema: "public",
      name: "posts",
      columns: [{ name: "id", type: "uuid", nullable: false, identity: true }],
    });

    expect(result.sql).toContain("CREATE TABLE public.posts");
  });

  it("appends entity to intent graph when one exists", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [
      {
        id: "public.users",
        schema: "public",
        name: "users",
        managedStatus: "managed",
        confidence: 0.9,
        columns: [],
        constraints: [],
        indexes: [],
      },
    ]);

    await runCreateTable(ctx, {
      schema: "public",
      name: "posts",
      columns: [{ name: "id", type: "uuid", nullable: false, identity: true }],
    });

    const updated = readArtifactOrNull<IntentGraph>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_GRAPH.id,
      STUDIO_ARTIFACTS.INTENT_GRAPH.version
    );
    expect(updated?.data.entities.length).toBe(2);
    const posts = updated?.data.entities.find((e) => e.id === "public.posts");
    expect(posts).toBeDefined();
    expect(posts?.managedStatus).toBe("managed");
  });

  it("does not duplicate entity if already in intent graph", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [
      {
        id: "public.posts",
        schema: "public",
        name: "posts",
        managedStatus: "managed",
        confidence: 0.9,
        columns: [],
        constraints: [],
        indexes: [],
      },
    ]);

    await runCreateTable(ctx, {
      schema: "public",
      name: "posts",
      columns: [{ name: "id", type: "uuid", nullable: false }],
    });

    const updated = readArtifactOrNull<IntentGraph>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_GRAPH.id,
      STUDIO_ARTIFACTS.INTENT_GRAPH.version
    );
    // Should still be 1 — no duplicate
    expect(updated?.data.entities.length).toBe(1);
  });
});
