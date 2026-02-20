/**
 * Tests for rpc-lint tool.
 */
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { writeArtifact, readArtifactOrNull } from "@sbtools/sdk";
import type { FunctionNode, IntentGraph, PluginContext } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../src/artifacts/constants.js";
import { runRpcLint } from "../../src/tools/rpc-lint.js";
import type { RpcPlanData } from "../../src/artifacts/writers.js";

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-rpc-lint-test-"));
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

function makeFunction(overrides: Partial<FunctionNode> = {}): FunctionNode {
  return {
    id: "public.get_data",
    schema: "public",
    name: "get_data",
    args: [],
    returnType: "text",
    language: "plpgsql",
    security: "invoker",
    volatility: "stable",
    body: "SELECT 'ok';",
    managedStatus: "managed",
    confidence: 0.9,
    ...overrides,
  };
}

function writeIntentGraph(ctx: PluginContext, functions: FunctionNode[]) {
  const graph: IntentGraph = {
    version: "1.0.0",
    mode: "brownfield-managed",
    entities: [],
    views: [],
    functions,
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

describe("runRpcLint", () => {
  it("reports no warnings for safe invoker functions", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [makeFunction({ security: "invoker" })]);

    const result = await runRpcLint(ctx);

    expect(result.functions).toHaveLength(1);
    expect(result.functions[0]?.lintWarnings).toHaveLength(0);
    expect(result.securityDefinerCount).toBe(0);
    expect(result.missingSearchPathCount).toBe(0);
  });

  it("warns on SECURITY DEFINER without search_path", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [
      makeFunction({
        id: "public.admin_action",
        name: "admin_action",
        security: "definer",
        // No searchPath
      }),
    ]);

    const result = await runRpcLint(ctx);

    expect(result.securityDefinerCount).toBe(1);
    expect(result.missingSearchPathCount).toBe(1);
    const fn = result.functions[0];
    expect(fn?.lintWarnings.some((w) => w.includes("DEFINER_NO_SEARCH_PATH"))).toBe(true);
  });

  it("does not warn on SECURITY DEFINER with explicit search_path", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [
      makeFunction({
        security: "definer",
        searchPath: ["public", "pg_temp"],
      }),
    ]);

    const result = await runRpcLint(ctx);

    const fn = result.functions[0];
    const definerNoSearchPath = fn?.lintWarnings.filter((w) =>
      w.includes("DEFINER_NO_SEARCH_PATH")
    );
    expect(definerNoSearchPath).toHaveLength(0);
    expect(result.missingSearchPathCount).toBe(0);
  });

  it("warns on SECURITY DEFINER in public schema", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [
      makeFunction({
        schema: "public",
        security: "definer",
        searchPath: ["public", "pg_temp"],
      }),
    ]);

    const result = await runRpcLint(ctx);

    const fn = result.functions[0];
    expect(fn?.lintWarnings.some((w) => w.includes("DEFINER_PUBLIC_EXPOSURE"))).toBe(true);
  });

  it("warns when function body is empty", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [makeFunction({ body: "" })]);

    const result = await runRpcLint(ctx);

    const fn = result.functions[0];
    expect(fn?.lintWarnings.some((w) => w.includes("EMPTY_FUNCTION_BODY"))).toBe(true);
  });

  it("skips opaque functions", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [makeFunction({ managedStatus: "opaque" })]);

    const result = await runRpcLint(ctx);

    expect(result.functions).toHaveLength(0);
  });

  it("throws MISSING_ARTIFACT when intent graph not found", async () => {
    const { ctx } = makeTempCtx();

    await expect(runRpcLint(ctx)).rejects.toMatchObject({ code: "MISSING_ARTIFACT" });
  });

  it("writes artifact to disk", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [makeFunction()]);

    await runRpcLint(ctx);

    const env = readArtifactOrNull<RpcPlanData>(
      ctx,
      STUDIO_ARTIFACTS.RPC_PLAN.id,
      STUDIO_ARTIFACTS.RPC_PLAN.version
    );
    expect(env?.data).toBeDefined();
  });
});
