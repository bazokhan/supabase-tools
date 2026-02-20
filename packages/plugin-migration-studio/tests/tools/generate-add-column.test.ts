/**
 * Tests for generate-add-column tool.
 */
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { writeArtifact } from "@sbtools/sdk";
import type { EntityNode, IntentGraph, PluginContext } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../src/artifacts/constants.js";
import { runAddColumn } from "../../src/tools/generate-add-column.js";

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-add-column-test-"));
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

describe("runAddColumn", () => {
  it("generates ALTER TABLE ADD COLUMN and writes migration file", async () => {
    const { ctx, migrationsDir } = makeTempCtx();
    const entities: EntityNode[] = [
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
    ];
    writeIntentGraph(ctx, entities);

    const result = await runAddColumn(ctx, {
      entityId: "public.users",
      column: { name: "avatar_url", type: "text", nullable: true },
    });

    expect(result.sql).toContain("ALTER TABLE");
    expect(result.sql).toContain("public");
    expect(result.sql).toContain("users");
    expect(result.sql).toContain("avatar_url");
    expect(result.sql).toContain("text");
    expect(result.filename).toMatch(/^\d+_add_column_users_avatar_url\.sql$/);

    const filePath = path.join(migrationsDir, result.filename);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toBe(result.sql + "\n");
  });

  it("adds NOT NULL when nullable is false", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [
      { id: "public.orders", schema: "public", name: "orders", managedStatus: "managed", confidence: 0.9, columns: [], constraints: [], indexes: [] },
    ]);

    const result = await runAddColumn(ctx, {
      entityId: "public.orders",
      column: { name: "total", type: "numeric", nullable: false },
    });

    expect(result.sql).toContain("NOT NULL");
  });

  it("adds DEFAULT when provided", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [
      { id: "public.tasks", schema: "public", name: "tasks", managedStatus: "managed", confidence: 0.9, columns: [], constraints: [], indexes: [] },
    ]);

    const result = await runAddColumn(ctx, {
      entityId: "public.tasks",
      column: { name: "status", type: "text", nullable: true, default: "''" },
    });

    expect(result.sql).toContain("DEFAULT ''");
  });

  it("throws ENTITY_NOT_FOUND when entity missing", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [
      { id: "public.users", schema: "public", name: "users", managedStatus: "managed", confidence: 0.9, columns: [], constraints: [], indexes: [] },
    ]);

    await expect(
      runAddColumn(ctx, {
        entityId: "public.nonexistent",
        column: { name: "x", type: "text", nullable: true },
      })
    ).rejects.toMatchObject({ code: "ENTITY_NOT_FOUND", entityId: "public.nonexistent" });
  });

  it("throws ENTITY_OPAQUE when entity is opaque", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [
      { id: "public.legacy", schema: "public", name: "legacy", managedStatus: "opaque", confidence: 0.3, columns: [], constraints: [], indexes: [] },
    ]);

    await expect(
      runAddColumn(ctx, {
        entityId: "public.legacy",
        column: { name: "x", type: "text", nullable: true },
      })
    ).rejects.toMatchObject({ code: "ENTITY_OPAQUE", entityId: "public.legacy" });
  });

  it("throws MISSING_ARTIFACT when intent graph not found", async () => {
    const { ctx } = makeTempCtx();
    // No intent graph written

    await expect(
      runAddColumn(ctx, {
        entityId: "public.users",
        column: { name: "x", type: "text", nullable: true },
      })
    ).rejects.toMatchObject({ code: "MISSING_ARTIFACT" });
  });
});
