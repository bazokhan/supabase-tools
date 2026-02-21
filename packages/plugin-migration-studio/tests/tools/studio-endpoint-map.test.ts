/**
 * Tests for endpoint-map tool.
 */
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { writeArtifact, readArtifactOrNull } from "@sbtools/sdk";
import type { FunctionNode, IntentGraph, PluginContext } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../src/artifacts/constants.js";
import { runEndpointMap } from "../../src/tools/core/studio-endpoint-map.core.js";

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-endpoint-map-test-"));
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

function baseGraph(): IntentGraph {
  return {
    version: "1.0.0",
    mode: "brownfield-managed",
    entities: [],
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

describe("runEndpointMap", () => {
  it("creates table-crud endpoints for managed entities", async () => {
    const { ctx } = makeTempCtx();
    const graph = baseGraph();
    graph.entities = [
      { id: "public.users", schema: "public", name: "users", managedStatus: "managed", confidence: 0.9, columns: [], constraints: [], indexes: [] },
    ];
    writeGraph(ctx, graph);

    const result = await runEndpointMap(ctx);

    expect(result.entityEndpoints).toBe(1);
    expect(result.rpcEndpoints).toBe(0);
    expect(result.total).toBe(1);
  });

  it("skips non-managed entities", async () => {
    const { ctx } = makeTempCtx();
    const graph = baseGraph();
    graph.entities = [
      { id: "public.users", schema: "public", name: "users", managedStatus: "managed", confidence: 0.9, columns: [], constraints: [], indexes: [] },
      { id: "public.logs", schema: "public", name: "logs", managedStatus: "opaque", confidence: 0.3, columns: [], constraints: [], indexes: [] },
      { id: "public.excluded_table", schema: "public", name: "excluded_table", managedStatus: "excluded", confidence: 0.9, columns: [], constraints: [], indexes: [] },
    ];
    writeGraph(ctx, graph);

    const result = await runEndpointMap(ctx);

    expect(result.entityEndpoints).toBe(1);
  });

  it("creates rpc endpoints for managed public-schema functions", async () => {
    const { ctx } = makeTempCtx();
    const graph = baseGraph();
    graph.functions = [
      {
        id: "public.get_user(uuid)",
        schema: "public",
        name: "get_user",
        args: [],
        returnType: "jsonb",
        language: "plpgsql",
        security: "invoker",
        volatility: "stable",
        managedStatus: "managed",
        confidence: 0.9,
      } as FunctionNode,
    ];
    writeGraph(ctx, graph);

    const result = await runEndpointMap(ctx);

    expect(result.rpcEndpoints).toBe(1);
    expect(result.entityEndpoints).toBe(0);
  });

  it("skips functions not in public schema", async () => {
    const { ctx } = makeTempCtx();
    const graph = baseGraph();
    graph.functions = [
      {
        id: "private.internal_fn()",
        schema: "private",
        name: "internal_fn",
        args: [],
        returnType: "void",
        language: "plpgsql",
        security: "definer",
        volatility: "volatile",
        managedStatus: "managed",
        confidence: 0.9,
      } as FunctionNode,
    ];
    writeGraph(ctx, graph);

    const result = await runEndpointMap(ctx);

    expect(result.rpcEndpoints).toBe(0);
    expect(result.total).toBe(0);
  });

  it("collects allowedRoles from entity policies", async () => {
    const { ctx } = makeTempCtx();
    const graph = baseGraph();
    graph.entities = [
      { id: "public.users", schema: "public", name: "users", managedStatus: "managed", confidence: 0.9, columns: [], constraints: [], indexes: [] },
    ];
    graph.policies = [
      { id: "policy:public.users.select", entity: "public.users", name: "select", command: "SELECT", roles: ["authenticated"], using: "true", permissive: true, managedStatus: "managed", confidence: 0.9 },
      { id: "policy:public.users.insert", entity: "public.users", name: "insert", command: "INSERT", roles: ["authenticated", "service_role"], withCheck: "true", permissive: true, managedStatus: "managed", confidence: 0.9 },
    ];
    writeGraph(ctx, graph);

    await runEndpointMap(ctx);

    const env = readArtifactOrNull<IntentGraph>(ctx, STUDIO_ARTIFACTS.INTENT_GRAPH.id, STUDIO_ARTIFACTS.INTENT_GRAPH.version);
    const endpoint = env?.data.endpoints.find((e) => e.type === "table-crud");
    expect(endpoint?.allowedRoles).toContain("authenticated");
    expect(endpoint?.allowedRoles).toContain("service_role");
    // No duplicates
    expect(endpoint?.allowedRoles.filter((r) => r === "authenticated")).toHaveLength(1);
  });

  it("writes endpoints back to the intent graph artifact", async () => {
    const { ctx } = makeTempCtx();
    const graph = baseGraph();
    graph.entities = [
      { id: "public.users", schema: "public", name: "users", managedStatus: "managed", confidence: 0.9, columns: [], constraints: [], indexes: [] },
    ];
    writeGraph(ctx, graph);

    await runEndpointMap(ctx);

    const env = readArtifactOrNull<IntentGraph>(ctx, STUDIO_ARTIFACTS.INTENT_GRAPH.id, STUDIO_ARTIFACTS.INTENT_GRAPH.version);
    expect(env?.data.endpoints).toHaveLength(1);
    expect(env?.data.endpoints[0].type).toBe("table-crud");
    expect(env?.producer).toBe("endpoint-map");
  });

  it("replaces any existing endpoints on each run", async () => {
    const { ctx } = makeTempCtx();
    const graph = baseGraph();
    graph.entities = [
      { id: "public.users", schema: "public", name: "users", managedStatus: "managed", confidence: 0.9, columns: [], constraints: [], indexes: [] },
    ];
    graph.endpoints = [
      { id: "endpoint:table-crud:public.stale", type: "table-crud", entity: "public.stale", exposedVia: "postgrest", allowedRoles: [], operations: ["read"] },
    ];
    writeGraph(ctx, graph);

    await runEndpointMap(ctx);

    const env = readArtifactOrNull<IntentGraph>(ctx, STUDIO_ARTIFACTS.INTENT_GRAPH.id, STUDIO_ARTIFACTS.INTENT_GRAPH.version);
    expect(env?.data.endpoints).toHaveLength(1);
    expect(env?.data.endpoints[0].entity).toBe("public.users");
  });

  it("throws MISSING_ARTIFACT when no intent graph exists", async () => {
    const { ctx } = makeTempCtx();

    await expect(runEndpointMap(ctx)).rejects.toMatchObject({ code: "MISSING_ARTIFACT" });
  });

  it("returns zero counts when no managed entities or functions", async () => {
    const { ctx } = makeTempCtx();
    writeGraph(ctx, baseGraph());

    const result = await runEndpointMap(ctx);

    expect(result.entityEndpoints).toBe(0);
    expect(result.rpcEndpoints).toBe(0);
    expect(result.total).toBe(0);
  });
});


