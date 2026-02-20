/**
 * Tests for greenfield-init tool.
 */
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { readArtifactOrNull, writeArtifact } from "@sbtools/sdk";
import type { IntentGraph, PluginContext } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../src/artifacts/constants.js";
import { runGreenfieldInit } from "../../src/tools/greenfield-init.js";

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-greenfield-init-test-"));
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

describe("runGreenfieldInit", () => {
  it("creates an intent graph with mode: greenfield", async () => {
    const { ctx } = makeTempCtx();

    const graph = await runGreenfieldInit(ctx);

    expect(graph.mode).toBe("greenfield");
  });

  it("creates an empty graph with no entities, policies, or functions", async () => {
    const { ctx } = makeTempCtx();

    const graph = await runGreenfieldInit(ctx);

    expect(graph.entities).toHaveLength(0);
    expect(graph.policies).toHaveLength(0);
    expect(graph.functions).toHaveLength(0);
    expect(graph.views).toHaveLength(0);
    expect(graph.triggers).toHaveLength(0);
  });

  it("sets managed scope to public schema by default", async () => {
    const { ctx } = makeTempCtx();

    const graph = await runGreenfieldInit(ctx);

    expect(graph.managedScope.schemas["public"]).toBe("managed");
    expect(graph.managedScope.explicitExclusions).toHaveLength(0);
  });

  it("writes the intent graph artifact to disk", async () => {
    const { ctx } = makeTempCtx();

    await runGreenfieldInit(ctx);

    const env = readArtifactOrNull<IntentGraph>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_GRAPH.id,
      STUDIO_ARTIFACTS.INTENT_GRAPH.version
    );
    expect(env?.data).toBeDefined();
    expect(env?.data.mode).toBe("greenfield");
    expect(env?.producer).toBe("greenfield-init");
  });

  it("works without a DB connection (no projectRoot introspection needed)", async () => {
    const { ctx } = makeTempCtx();
    // No DB config, no supabase running — should complete without error
    await expect(runGreenfieldInit(ctx)).resolves.toBeDefined();
  });

  it("overwrites an existing intent graph with a fresh greenfield graph", async () => {
    const { ctx } = makeTempCtx();

    // Write a brownfield graph first
    const brownfield: IntentGraph = {
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
    writeArtifact(ctx, {
      id: STUDIO_ARTIFACTS.INTENT_GRAPH.id,
      version: STUDIO_ARTIFACTS.INTENT_GRAPH.version,
      producer: "test",
      generatedAt: new Date().toISOString(),
      data: brownfield,
    });

    // Now init greenfield
    const graph = await runGreenfieldInit(ctx);

    expect(graph.mode).toBe("greenfield");
    expect(graph.entities).toHaveLength(0);

    const env = readArtifactOrNull<IntentGraph>(
      ctx,
      STUDIO_ARTIFACTS.INTENT_GRAPH.id,
      STUDIO_ARTIFACTS.INTENT_GRAPH.version
    );
    expect(env?.data.mode).toBe("greenfield");
    expect(env?.data.entities).toHaveLength(0);
  });

  it("sets version to 1.0.0", async () => {
    const { ctx } = makeTempCtx();

    const graph = await runGreenfieldInit(ctx);

    expect(graph.version).toBe("1.0.0");
  });
});
