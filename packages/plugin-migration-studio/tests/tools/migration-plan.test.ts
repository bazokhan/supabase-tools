/**
 * Tests for migration-plan tool.
 */
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { writeArtifact, readArtifactOrNull } from "@sbtools/sdk";
import type { EntityNode, IntentGraph, PolicyNode, PluginContext } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../src/artifacts/constants.js";
import { runMigrationPlan } from "../../src/tools/migration-plan.js";
import type { SchemaSnapshotData, MigrationPlanData } from "../../src/artifacts/writers.js";

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-migration-plan-test-"));
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

function makeEntity(
  id: string,
  columns: EntityNode["columns"] = [],
  constraints: EntityNode["constraints"] = []
): EntityNode {
  const parts = id.split(".");
  return {
    id,
    schema: parts[0] ?? "public",
    name: parts[1] ?? id,
    managedStatus: "managed",
    confidence: 0.9,
    columns,
    constraints,
    indexes: [],
  };
}

function makeColumn(name: string, type = "text", nullable = true, defaultVal?: string): EntityNode["columns"][number] {
  return {
    name,
    type,
    nullable,
    default: defaultVal,
    managedStatus: "managed",
    confidence: 0.9,
  };
}

function writeIntentGraph(ctx: PluginContext, entities: EntityNode[], policies: PolicyNode[] = []) {
  const graph: IntentGraph = {
    version: "1.0.0",
    mode: "brownfield-managed",
    entities,
    views: [],
    functions: [],
    triggers: [],
    policies,
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

function writeSnapshot(ctx: PluginContext, entities: EntityNode[], policies: PolicyNode[] = []) {
  const snapshot: SchemaSnapshotData = {
    capturedAt: new Date().toISOString(),
    entities,
    views: [],
    functions: [],
    policies,
    triggers: [],
    infrastructure: [],
  };
  writeArtifact(ctx, {
    id: STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id,
    version: STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.version,
    producer: "test",
    generatedAt: new Date().toISOString(),
    data: snapshot,
  });
}

describe("runMigrationPlan", () => {
  it("produces CREATE TABLE change for entity in intent but not in snapshot", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [makeEntity("public.posts", [makeColumn("id", "uuid", false)])]);
    writeSnapshot(ctx, []);

    const result = await runMigrationPlan(ctx);

    expect(result.totalChanges).toBe(1);
    expect(result.changes[0]?.changeClass).toBe("additive_safe");
    expect(result.changes[0]?.objectId).toBe("public.posts");
    expect(result.changes[0]?.sql[0]).toContain("CREATE TABLE");
    expect(result.changes[0]?.sql[0]).toContain("ENABLE ROW LEVEL SECURITY");
  });

  it("produces additive_safe change for new nullable column", async () => {
    const { ctx } = makeTempCtx();
    const baseEntity = makeEntity("public.users", [makeColumn("id", "uuid", false)]);
    const extendedEntity = makeEntity("public.users", [
      makeColumn("id", "uuid", false),
      makeColumn("bio", "text", true), // new nullable column
    ]);
    writeIntentGraph(ctx, [extendedEntity]);
    writeSnapshot(ctx, [baseEntity]);

    const result = await runMigrationPlan(ctx);

    expect(result.totalChanges).toBe(1);
    const change = result.changes[0];
    expect(change?.changeClass).toBe("additive_safe");
    expect(change?.sql[0]).toContain("ADD COLUMN bio");
  });

  it("produces additive_with_default change for new NOT NULL column with default", async () => {
    const { ctx } = makeTempCtx();
    const base = makeEntity("public.users", [makeColumn("id", "uuid", false)]);
    const extended = makeEntity("public.users", [
      makeColumn("id", "uuid", false),
      makeColumn("status", "text", false, "'active'"), // NOT NULL with DEFAULT
    ]);
    writeIntentGraph(ctx, [extended]);
    writeSnapshot(ctx, [base]);

    const result = await runMigrationPlan(ctx);

    const change = result.changes[0];
    expect(change?.changeClass).toBe("additive_with_default");
    expect(change?.sql[0]).toContain("DEFAULT 'active'");
  });

  it("produces type_change_narrowing for NOT NULL column without default", async () => {
    const { ctx } = makeTempCtx();
    const base = makeEntity("public.users", [makeColumn("id", "uuid", false)]);
    const extended = makeEntity("public.users", [
      makeColumn("id", "uuid", false),
      makeColumn("email", "text", false), // NOT NULL, no default — risky
    ]);
    writeIntentGraph(ctx, [extended]);
    writeSnapshot(ctx, [base]);

    const result = await runMigrationPlan(ctx);

    const change = result.changes[0];
    expect(change?.changeClass).toBe("type_change_narrowing");
    expect(change?.requiresConfirmation).toBe(true);
  });

  it("produces drop change for column in snapshot but not in intent", async () => {
    const { ctx } = makeTempCtx();
    const intent = makeEntity("public.users", [makeColumn("id", "uuid", false)]);
    const snap = makeEntity("public.users", [
      makeColumn("id", "uuid", false),
      makeColumn("legacy_field", "text", true),
    ]);
    writeIntentGraph(ctx, [intent]);
    writeSnapshot(ctx, [snap]);

    const result = await runMigrationPlan(ctx);

    const dropChange = result.changes.find((c) => c.changeClass === "drop");
    expect(dropChange).toBeDefined();
    expect(dropChange?.sql[0]).toContain("DESTRUCTIVE");
    expect(dropChange?.requiresConfirmation).toBe(true);
    expect(result.destructiveCount).toBe(1);
  });

  it("produces policy_change for new policy in intent not in snapshot", async () => {
    const { ctx } = makeTempCtx();
    const entity = makeEntity("public.posts");
    const policy: PolicyNode = {
      id: "policy:public.posts.posts_select",
      entity: "public.posts",
      name: "posts_select",
      command: "SELECT",
      roles: ["authenticated"],
      using: "true",
      permissive: true,
      managedStatus: "managed",
      confidence: 0.9,
    };
    writeIntentGraph(ctx, [entity], [policy]);
    writeSnapshot(ctx, [entity], []); // no policies in snapshot

    const result = await runMigrationPlan(ctx);

    const policyChange = result.changes.find((c) => c.changeClass === "policy_change");
    expect(policyChange).toBeDefined();
    expect(policyChange?.sql[0]).toContain("CREATE POLICY");
  });

  it("produces no changes when intent matches snapshot", async () => {
    const { ctx } = makeTempCtx();
    const entity = makeEntity("public.users", [makeColumn("id", "uuid", false)]);
    writeIntentGraph(ctx, [entity]);
    writeSnapshot(ctx, [entity]);

    const result = await runMigrationPlan(ctx);

    expect(result.totalChanges).toBe(0);
    expect(result.changes).toHaveLength(0);
  });

  it("sorts additive changes before destructive changes", async () => {
    const { ctx } = makeTempCtx();
    const intent = makeEntity("public.users", [
      makeColumn("id", "uuid", false),
      makeColumn("email", "text", true), // new column — additive_safe
    ]);
    const snap = makeEntity("public.users", [
      makeColumn("id", "uuid", false),
      makeColumn("old_col", "text", true), // removed — drop
    ]);
    writeIntentGraph(ctx, [intent]);
    writeSnapshot(ctx, [snap]);

    const result = await runMigrationPlan(ctx);

    const classes = result.changes.map((c) => c.changeClass);
    const addIdx = classes.indexOf("additive_safe");
    const dropIdx = classes.indexOf("drop");
    expect(addIdx).toBeLessThan(dropIdx);
  });

  it("throws MISSING_ARTIFACT when intent graph not found", async () => {
    const { ctx } = makeTempCtx();
    writeSnapshot(ctx, []);

    await expect(runMigrationPlan(ctx)).rejects.toMatchObject({ code: "MISSING_ARTIFACT" });
  });

  it("throws MISSING_ARTIFACT when snapshot not found", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, []);

    await expect(runMigrationPlan(ctx)).rejects.toMatchObject({ code: "MISSING_ARTIFACT" });
  });

  it("writes artifact to disk with snapshotHash", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, []);
    writeSnapshot(ctx, []);

    await runMigrationPlan(ctx);

    const env = readArtifactOrNull<MigrationPlanData>(
      ctx,
      STUDIO_ARTIFACTS.MIGRATION_PLAN.id,
      STUDIO_ARTIFACTS.MIGRATION_PLAN.version
    );
    expect(env?.data).toBeDefined();
    expect(env?.data.snapshotHash).toBeTruthy();
    expect(env?.data.snapshotHash.length).toBeGreaterThan(0);
  });
});
