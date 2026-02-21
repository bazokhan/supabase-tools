/**
 * Tests for intent-patch tool.
 */
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { writeArtifact, readArtifactOrNull } from "@sbtools/sdk";
import type { IntentGraph, PluginContext } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../src/artifacts/constants.js";
import { runIntentPatch } from "../../src/tools/core/studio-intent-patch.core.js";

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-intent-patch-test-"));
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

function writeGraph(ctx: PluginContext, graph: IntentGraph) {
  writeArtifact(ctx, {
    id: STUDIO_ARTIFACTS.INTENT_GRAPH.id,
    version: STUDIO_ARTIFACTS.INTENT_GRAPH.version,
    producer: "test",
    generatedAt: new Date().toISOString(),
    data: graph,
  });
}

function makeGraph(): IntentGraph {
  return {
    version: "1.0.0",
    mode: "brownfield-managed",
    entities: [
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
      {
        id: "public.orders",
        schema: "public",
        name: "orders",
        managedStatus: "assisted",
        confidence: 0.6,
        columns: [],
        constraints: [],
        indexes: [],
      },
    ],
    views: [],
    functions: [],
    triggers: [],
    policies: [],
    endpoints: [],
    infrastructure: [],
    opaqueBlocks: [],
    managedScope: { schemas: { public: "managed" }, explicitExclusions: [] },
  };
}

describe("runIntentPatch", () => {
  it("excludes an entity and adds to explicitExclusions", async () => {
    const { ctx } = makeTempCtx();
    writeGraph(ctx, makeGraph());

    const result = await runIntentPatch(ctx, { entityId: "public.users", action: "exclude" });

    expect(result.previousStatus).toBe("managed");
    expect(result.newStatus).toBe("excluded");
    expect(result.excludedCount).toBe(1);
  });

  it("persists excluded status to disk", async () => {
    const { ctx } = makeTempCtx();
    writeGraph(ctx, makeGraph());

    await runIntentPatch(ctx, { entityId: "public.users", action: "exclude" });

    const env = readArtifactOrNull<IntentGraph>(ctx, STUDIO_ARTIFACTS.INTENT_GRAPH.id, STUDIO_ARTIFACTS.INTENT_GRAPH.version);
    const entity = env?.data.entities.find((e) => e.id === "public.users");
    expect(entity?.managedStatus).toBe("excluded");
    expect(env?.data.managedScope.explicitExclusions).toContain("public.users");
  });

  it("does not duplicate an entity in explicitExclusions", async () => {
    const { ctx } = makeTempCtx();
    const graph = makeGraph();
    graph.managedScope.explicitExclusions = ["public.users"];
    graph.entities[0].managedStatus = "excluded";
    writeGraph(ctx, graph);

    await runIntentPatch(ctx, { entityId: "public.users", action: "exclude" });

    const env = readArtifactOrNull<IntentGraph>(ctx, STUDIO_ARTIFACTS.INTENT_GRAPH.id, STUDIO_ARTIFACTS.INTENT_GRAPH.version);
    const exclusions = env?.data.managedScope.explicitExclusions ?? [];
    expect(exclusions.filter((id) => id === "public.users")).toHaveLength(1);
  });

  it("set-status changes entity managedStatus", async () => {
    const { ctx } = makeTempCtx();
    writeGraph(ctx, makeGraph());

    const result = await runIntentPatch(ctx, {
      entityId: "public.orders",
      action: "set-status",
      status: "managed",
    });

    expect(result.previousStatus).toBe("assisted");
    expect(result.newStatus).toBe("managed");
  });

  it("set-status removes entity from explicitExclusions when promoting", async () => {
    const { ctx } = makeTempCtx();
    const graph = makeGraph();
    graph.entities[0].managedStatus = "excluded";
    graph.managedScope.explicitExclusions = ["public.users"];
    writeGraph(ctx, graph);

    await runIntentPatch(ctx, { entityId: "public.users", action: "set-status", status: "managed" });

    const env = readArtifactOrNull<IntentGraph>(ctx, STUDIO_ARTIFACTS.INTENT_GRAPH.id, STUDIO_ARTIFACTS.INTENT_GRAPH.version);
    expect(env?.data.managedScope.explicitExclusions).not.toContain("public.users");
  });

  it("throws MISSING_ARTIFACT when no intent graph exists", async () => {
    const { ctx } = makeTempCtx();

    await expect(runIntentPatch(ctx, { entityId: "public.users", action: "exclude" })).rejects.toMatchObject({
      code: "MISSING_ARTIFACT",
    });
  });

  it("throws when entityId is not found in the graph", async () => {
    const { ctx } = makeTempCtx();
    writeGraph(ctx, makeGraph());

    await expect(
      runIntentPatch(ctx, { entityId: "public.nonexistent", action: "exclude" })
    ).rejects.toThrow("not found");
  });

  it("throws when set-status is called without a status value", async () => {
    const { ctx } = makeTempCtx();
    writeGraph(ctx, makeGraph());

    await expect(
      runIntentPatch(ctx, { entityId: "public.users", action: "set-status" })
    ).rejects.toThrow("status is required");
  });

  it("does not mutate other entities when patching one", async () => {
    const { ctx } = makeTempCtx();
    writeGraph(ctx, makeGraph());

    await runIntentPatch(ctx, { entityId: "public.users", action: "exclude" });

    const env = readArtifactOrNull<IntentGraph>(ctx, STUDIO_ARTIFACTS.INTENT_GRAPH.id, STUDIO_ARTIFACTS.INTENT_GRAPH.version);
    const orders = env?.data.entities.find((e) => e.id === "public.orders");
    expect(orders?.managedStatus).toBe("assisted");
  });
});


