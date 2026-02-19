/**
 * Tests for studio-intent-init tool.
 *
 * Verifies managedStatus assignment from confidence scores:
 * - >= 0.80 → 'managed'
 * - 0.50-0.79 → 'assisted'
 * - < 0.50 → 'opaque' (→ OpaqueBlock)
 *
 * And graph mode selection:
 * - >= 80% managed entities → 'brownfield-managed'
 * - < 80% managed entities → 'brownfield-assisted'
 */
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { writeArtifact, readArtifactOrNull } from "@sbtools/sdk";
import type { EntityNode, IntentGraph, PluginContext } from "@sbtools/sdk";
import type { SchemaSnapshotData, SqlAstData, IntentSyncData } from "../../src/artifacts/writers.js";
import { STUDIO_ARTIFACTS } from "../../src/artifacts/constants.js";
import { runIntentInit } from "../../src/tools/intent-init.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-intent-init-test-"));
  const sbtDataDir = path.join(dir, ".sbt");
  fs.mkdirSync(sbtDataDir, { recursive: true });
  return {
    ctx: {
      projectRoot: dir,
      sbtDataDir,
      pluginConfig: {},
      paths: {},
    } as unknown as PluginContext,
  };
}

function makeEntity(id: string): EntityNode {
  const [schema, name] = id.includes(".") ? id.split(".") : ["public", id];
  return {
    id,
    schema,
    name,
    managedStatus: "managed",
    confidence: 0.9,
    columns: [{ name: "id", type: "uuid", nullable: false, managedStatus: "managed", confidence: 0.9 }],
    constraints: [],
    indexes: [],
  };
}

function writeFixtures(
  ctx: PluginContext,
  matched: Array<{ objectId: string; confidence: number }>,
  unmatchedDb: string[] = [],
  unmatchedIntent: string[] = [],
  dbEntities: EntityNode[] = []
) {
  // Write sync report
  const syncData: IntentSyncData = {
    syncedAt: new Date().toISOString(),
    matched: matched.map((m) => ({ objectId: m.objectId, objectType: "entity", confidence: m.confidence })),
    unmatchedDb: unmatchedDb.map((id) => ({ objectId: id, objectType: "entity", reason: "no_sql_source" })),
    unmatchedIntent: unmatchedIntent.map((id) => ({ objectId: id, objectType: "entity" })),
    summary: {
      matchedCount: matched.length,
      unmatchedDbCount: unmatchedDb.length,
      unmatchedIntentCount: unmatchedIntent.length,
      averageConfidence: matched.length ? matched.reduce((s, m) => s + m.confidence, 0) / matched.length : 0,
    },
  };
  writeArtifact(ctx, {
    id: STUDIO_ARTIFACTS.INTENT_SYNC.id,
    version: STUDIO_ARTIFACTS.INTENT_SYNC.version,
    producer: "test",
    generatedAt: new Date().toISOString(),
    data: syncData,
  });

  // Write snapshot with DB entities for all matched + unmatchedDb
  const allIds = [...matched.map((m) => m.objectId), ...unmatchedDb];
  const entities = allIds.map((id) => dbEntities.find((e) => e.id === id) ?? makeEntity(id));
  const snapshotData: SchemaSnapshotData = {
    capturedAt: new Date().toISOString(),
    entities,
    views: [],
    functions: [],
    policies: [],
    triggers: [],
    infrastructure: [],
  };
  writeArtifact(ctx, {
    id: STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id,
    version: STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.version,
    producer: "test",
    generatedAt: new Date().toISOString(),
    data: snapshotData,
  });

  // Write AST with SQL entities for unmatchedIntent
  const sqlEntities = unmatchedIntent.map((id) => makeEntity(id));
  const astData: SqlAstData = {
    migrationsDir: "",
    parsedAt: new Date().toISOString(),
    files: [],
    totalStatements: 0,
    totalOpaqueBlocks: 0,
    allEntities: sqlEntities,
    allPolicies: [],
    allFunctions: [],
    allViews: [],
    allTriggers: [],
    allInfrastructure: [],
  };
  writeArtifact(ctx, {
    id: STUDIO_ARTIFACTS.SQL_AST.id,
    version: STUDIO_ARTIFACTS.SQL_AST.version,
    producer: "test",
    generatedAt: new Date().toISOString(),
    data: astData,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runIntentInit — managedStatus from confidence", () => {
  it("confidence >= 0.80 → entity.managedStatus = 'managed'", async () => {
    const { ctx } = makeTempCtx();
    writeFixtures(ctx, [{ objectId: "public.users", confidence: 0.92 }]);

    await runIntentInit(ctx);

    const env = readArtifactOrNull<IntentGraph>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_GRAPH.id,
      STUDIO_ARTIFACTS.INTENT_GRAPH.version
    );
    const entity = env!.data.entities.find((e) => e.id === "public.users");
    expect(entity).toBeDefined();
    expect(entity!.managedStatus).toBe("managed");
  });

  it("confidence 0.50–0.79 → entity.managedStatus = 'assisted'", async () => {
    const { ctx } = makeTempCtx();
    writeFixtures(ctx, [{ objectId: "public.orders", confidence: 0.65 }]);

    await runIntentInit(ctx);

    const env = readArtifactOrNull<IntentGraph>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_GRAPH.id,
      STUDIO_ARTIFACTS.INTENT_GRAPH.version
    );
    const entity = env!.data.entities.find((e) => e.id === "public.orders");
    expect(entity).toBeDefined();
    expect(entity!.managedStatus).toBe("assisted");
  });

  it("confidence < 0.50 → entity goes to opaqueBlocks, not entities list", async () => {
    const { ctx } = makeTempCtx();
    writeFixtures(ctx, [{ objectId: "public.legacy", confidence: 0.30 }]);

    await runIntentInit(ctx);

    const env = readArtifactOrNull<IntentGraph>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_GRAPH.id,
      STUDIO_ARTIFACTS.INTENT_GRAPH.version
    );
    const entity = env!.data.entities.find((e) => e.id === "public.legacy");
    expect(entity).toBeUndefined(); // not in entities list

    const opaque = env!.data.opaqueBlocks.find((b) => b.touchedObjects.includes("public.legacy"));
    expect(opaque).toBeDefined();
  });

  it("DB-only entities (unmatchedDb) go to opaqueBlocks", async () => {
    const { ctx } = makeTempCtx();
    writeFixtures(ctx, [], ["public.mystery"]);

    await runIntentInit(ctx);

    const env = readArtifactOrNull<IntentGraph>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_GRAPH.id,
      STUDIO_ARTIFACTS.INTENT_GRAPH.version
    );
    const opaque = env!.data.opaqueBlocks.find((b) => b.touchedObjects.includes("public.mystery"));
    expect(opaque).toBeDefined();
    expect(opaque!.reason).toBe("too-complex");
  });

  it("SQL-only entities (unmatchedIntent) get managedStatus 'assisted'", async () => {
    const { ctx } = makeTempCtx();
    writeFixtures(ctx, [], [], ["public.upcoming"]);

    await runIntentInit(ctx);

    const env = readArtifactOrNull<IntentGraph>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_GRAPH.id,
      STUDIO_ARTIFACTS.INTENT_GRAPH.version
    );
    const entity = env!.data.entities.find((e) => e.id === "public.upcoming");
    expect(entity).toBeDefined();
    expect(entity!.managedStatus).toBe("assisted");
    expect(entity!.confidence).toBe(0.7);
  });
});

describe("runIntentInit — graph mode", () => {
  it("mode = 'brownfield-managed' when >= 80% entities are managed", async () => {
    const { ctx } = makeTempCtx();
    // 4 matched at high confidence → all managed
    writeFixtures(ctx, [
      { objectId: "public.a", confidence: 0.9 },
      { objectId: "public.b", confidence: 0.85 },
      { objectId: "public.c", confidence: 0.88 },
      { objectId: "public.d", confidence: 0.91 },
    ]);

    await runIntentInit(ctx);

    const env = readArtifactOrNull<IntentGraph>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_GRAPH.id,
      STUDIO_ARTIFACTS.INTENT_GRAPH.version
    );
    expect(env!.data.mode).toBe("brownfield-managed");
  });

  it("mode = 'brownfield-assisted' when < 80% entities are managed", async () => {
    const { ctx } = makeTempCtx();
    // Mix: 1 high, 3 low → many go to opaque → < 80% managed
    writeFixtures(ctx, [
      { objectId: "public.a", confidence: 0.9 },
      { objectId: "public.b", confidence: 0.3 },
      { objectId: "public.c", confidence: 0.2 },
      { objectId: "public.d", confidence: 0.1 },
    ]);

    await runIntentInit(ctx);

    const env = readArtifactOrNull<IntentGraph>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_GRAPH.id,
      STUDIO_ARTIFACTS.INTENT_GRAPH.version
    );
    expect(env!.data.mode).toBe("brownfield-assisted");
  });

  it("throws MISSING_ARTIFACT when sync report not found", async () => {
    const { ctx } = makeTempCtx();
    // Only write snapshot and AST, not sync report
    const snapshotData: SchemaSnapshotData = {
      capturedAt: new Date().toISOString(),
      entities: [],
      views: [],
      functions: [],
      policies: [],
      triggers: [],
      infrastructure: [],
    };
    writeArtifact(ctx, {
      id: STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id,
      version: STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.version,
      producer: "test",
      generatedAt: new Date().toISOString(),
      data: snapshotData,
    });

    await expect(runIntentInit(ctx)).rejects.toMatchObject({ code: "MISSING_ARTIFACT" });
  });

  it("graph has version '1.0.0'", async () => {
    const { ctx } = makeTempCtx();
    writeFixtures(ctx, [{ objectId: "public.x", confidence: 0.9 }]);

    await runIntentInit(ctx);

    const env = readArtifactOrNull<IntentGraph>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_GRAPH.id,
      STUDIO_ARTIFACTS.INTENT_GRAPH.version
    );
    expect(env!.data.version).toBe("1.0.0");
  });
});
