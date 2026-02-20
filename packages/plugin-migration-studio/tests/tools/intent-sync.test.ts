/**
 * Tests for studio-intent-sync tool.
 *
 * Verifies confidence scoring logic:
 * - DB+SQL match → base 0.85 + adjustments
 * - Column count bonus
 * - Missing column penalty
 * - DB-only → 0.35
 * - SQL-only → 0.70
 */
import { describe, it, expect, beforeEach } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { writeArtifact, readArtifactOrNull } from "@sbtools/sdk";
import type { EntityNode, PluginContext } from "@sbtools/sdk";
import type { SchemaSnapshotData, SqlAstData, IntentSyncData } from "../../src/artifacts/writers.js";
import { STUDIO_ARTIFACTS } from "../../src/artifacts/constants.js";
import { runIntentSync } from "../../src/tools/intent-sync.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-intent-sync-test-"));
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

function makeEntityNode(id: string, columns: string[] = []): EntityNode {
  const [schema, name] = id.includes(".") ? id.split(".") : ["public", id];
  return {
    id,
    schema,
    name,
    managedStatus: "managed",
    confidence: 0.9,
    columns: columns.map((c) => ({
      name: c,
      type: "text",
      nullable: true,
      managedStatus: "managed" as const,
      confidence: 0.9,
    })),
    constraints: [],
    indexes: [],
  };
}

function writeSnapshot(ctx: PluginContext, entities: EntityNode[]) {
  const data: SchemaSnapshotData = {
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
    data,
  });
}

function writeAstData(ctx: PluginContext, entities: Partial<EntityNode>[]) {
  const data: SqlAstData = {
    migrationsDir: "",
    parsedAt: new Date().toISOString(),
    files: [],
    totalStatements: entities.length,
    totalOpaqueBlocks: 0,
    allEntities: entities,
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
    data,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runIntentSync — confidence scoring", () => {
  it("matched entity (DB+SQL, same columns) gets confidence >= 0.85", async () => {
    const { ctx } = makeTempCtx();
    const cols = ["id", "name", "email"];
    writeSnapshot(ctx, [makeEntityNode("public.users", cols)]);
    writeAstData(ctx, [{ ...makeEntityNode("public.users", cols), managedStatus: "opaque" as const }]);

    await runIntentSync(ctx);

    const env = readArtifactOrNull<IntentSyncData>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_SYNC.id,
      STUDIO_ARTIFACTS.INTENT_SYNC.version
    );
    expect(env).not.toBeNull();
    const match = env!.data.matched.find((m) => m.objectId === "public.users");
    expect(match).toBeDefined();
    expect(match!.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("DB-only entity gets confidence 0.35", async () => {
    const { ctx } = makeTempCtx();
    writeSnapshot(ctx, [makeEntityNode("public.products")]);
    writeAstData(ctx, []); // no SQL entities

    await runIntentSync(ctx);

    const env = readArtifactOrNull<IntentSyncData>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_SYNC.id,
      STUDIO_ARTIFACTS.INTENT_SYNC.version
    );
    const unmatched = env!.data.unmatchedDb.find((m) => m.objectId === "public.products");
    expect(unmatched).toBeDefined();
    expect(unmatched!.reason).toBe("no_sql_source");
  });

  it("SQL-only entity appears in unmatchedIntent", async () => {
    const { ctx } = makeTempCtx();
    writeSnapshot(ctx, []); // no DB entities
    writeAstData(ctx, [{ ...makeEntityNode("public.pending_table") }]);

    await runIntentSync(ctx);

    const env = readArtifactOrNull<IntentSyncData>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_SYNC.id,
      STUDIO_ARTIFACTS.INTENT_SYNC.version
    );
    const unmatched = env!.data.unmatchedIntent.find((m) => m.objectId === "public.pending_table");
    expect(unmatched).toBeDefined();
  });

  it("column count bonus applies when columns match exactly", async () => {
    const { ctx } = makeTempCtx();
    const cols = ["id", "name"];
    writeSnapshot(ctx, [makeEntityNode("public.items", cols)]);
    writeAstData(ctx, [makeEntityNode("public.items", cols)]);

    await runIntentSync(ctx);

    const env = readArtifactOrNull<IntentSyncData>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_SYNC.id,
      STUDIO_ARTIFACTS.INTENT_SYNC.version
    );
    const match = env!.data.matched[0];
    // base 0.85 + column count exact (+0.05) + all names match (+0.05) + all types match (+0.03)
    expect(match.confidence).toBeGreaterThan(0.9);
  });

  it("confidence decreases for each missing column in SQL", async () => {
    const { ctx } = makeTempCtx();
    writeSnapshot(ctx, [makeEntityNode("public.big", ["a", "b", "c", "d"])]);
    writeAstData(ctx, [makeEntityNode("public.big", ["a"])]); // 3 missing

    await runIntentSync(ctx);

    const env = readArtifactOrNull<IntentSyncData>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_SYNC.id,
      STUDIO_ARTIFACTS.INTENT_SYNC.version
    );
    const matchFull = env!.data.matched.find((m) => m.objectId === "public.big");
    // 3 missing columns × 0.10 penalty each = -0.30 from base 0.85
    expect(matchFull!.confidence).toBeLessThan(0.85);
  });

  it("summary counts are correct", async () => {
    const { ctx } = makeTempCtx();
    writeSnapshot(ctx, [
      makeEntityNode("public.a"),
      makeEntityNode("public.b"), // DB only
    ]);
    writeAstData(ctx, [
      makeEntityNode("public.a"),
      makeEntityNode("public.c"), // SQL only
    ]);

    await runIntentSync(ctx);

    const env = readArtifactOrNull<IntentSyncData>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_SYNC.id,
      STUDIO_ARTIFACTS.INTENT_SYNC.version
    );
    const summary = env!.data.summary;
    expect(summary.matchedCount).toBe(1);
    expect(summary.unmatchedDbCount).toBe(1);
    expect(summary.unmatchedIntentCount).toBe(1);
    expect(summary.averageConfidence).toBeGreaterThan(0);
  });

  it("throws MISSING_ARTIFACT when snapshot not found", async () => {
    const { ctx } = makeTempCtx();
    // Don't write snapshot — only write AST
    writeAstData(ctx, []);

    await expect(runIntentSync(ctx)).rejects.toMatchObject({ code: "MISSING_ARTIFACT" });
  });

  it("throws MISSING_ARTIFACT when AST artifact not found", async () => {
    const { ctx } = makeTempCtx();
    writeSnapshot(ctx, []);
    // Don't write AST artifact

    await expect(runIntentSync(ctx)).rejects.toMatchObject({ code: "MISSING_ARTIFACT" });
  });
});
