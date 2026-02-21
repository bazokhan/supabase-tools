/**
 * Tests for rls-check tool.
 */
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { writeArtifact, readArtifactOrNull } from "@sbtools/sdk";
import type { EntityNode, FunctionNode, IntentGraph, PolicyNode, PluginContext } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../src/artifacts/constants.js";
import { runRlsCheck } from "../../src/tools/core/studio-rls-check.core.js";
import type { RlsReportData, RlsPlanData } from "../../src/artifacts/writers.js";

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-rls-check-test-"));
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

function makeEntity(id: string, managedStatus: EntityNode["managedStatus"] = "managed"): EntityNode {
  const parts = id.split(".");
  return {
    id,
    schema: parts[0] ?? "public",
    name: parts[1] ?? id,
    managedStatus,
    confidence: 0.9,
    columns: [],
    constraints: [],
    indexes: [],
  };
}

function makePolicy(entity: string, command: PolicyNode["command"]): PolicyNode {
  return {
    id: `policy:${entity}.${command.toLowerCase()}`,
    entity,
    name: `${entity.split(".")[1]}_${command.toLowerCase()}`,
    command,
    roles: ["authenticated"],
    permissive: true,
    managedStatus: "managed",
    confidence: 0.9,
  };
}

function writeIntentGraph(
  ctx: PluginContext,
  entities: EntityNode[],
  policies: PolicyNode[] = [],
  functions: FunctionNode[] = []
) {
  const graph: IntentGraph = {
    version: "1.0.0",
    mode: "brownfield-managed",
    entities,
    views: [],
    functions,
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

describe("runRlsCheck", () => {
  it("passes when all managed entities have full CRUD coverage", async () => {
    const { ctx } = makeTempCtx();
    const entity = makeEntity("public.users");
    const policies = [
      makePolicy("public.users", "SELECT"),
      makePolicy("public.users", "INSERT"),
      makePolicy("public.users", "UPDATE"),
      makePolicy("public.users", "DELETE"),
    ];
    writeIntentGraph(ctx, [entity], policies);

    const { report, plan } = await runRlsCheck(ctx);

    expect(report.status).toBe("pass");
    expect(report.gaps).toHaveLength(0);
    expect(report.entitiesChecked).toBe(1);
    expect(report.tablesWithRls).toBe(1);
    expect(report.tablesWithoutRls).toBe(0);
    expect(plan.policies).toHaveLength(0);
  });

  it("fails when entity has no policies", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [makeEntity("public.posts")]);

    const { report, plan } = await runRlsCheck(ctx);

    expect(report.status).toBe("fail");
    expect(report.gaps).toHaveLength(1);
    expect(report.gaps[0]?.entityId).toBe("public.posts");
    expect(report.gaps[0]?.missingCommands).toEqual(
      expect.arrayContaining(["SELECT", "INSERT", "UPDATE", "DELETE"])
    );
    // 4 suggested policies (one per command)
    expect(plan.policies).toHaveLength(4);
    expect(plan.entitiesWithoutPolicies).toContain("public.posts");
  });

  it("flags only missing commands when entity has partial coverage", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [makeEntity("public.items")], [makePolicy("public.items", "SELECT")]);

    const { report } = await runRlsCheck(ctx);

    expect(report.status).toBe("fail");
    const gap = report.gaps[0];
    expect(gap?.missingCommands).toEqual(expect.arrayContaining(["INSERT", "UPDATE", "DELETE"]));
    expect(gap?.missingCommands).not.toContain("SELECT");
  });

  it("treats ALL command as covering all CRUD operations", async () => {
    const { ctx } = makeTempCtx();
    const allPolicy: PolicyNode = {
      ...makePolicy("public.settings", "ALL"),
      command: "ALL",
    };
    writeIntentGraph(ctx, [makeEntity("public.settings")], [allPolicy]);

    const { report } = await runRlsCheck(ctx);

    expect(report.status).toBe("pass");
    expect(report.gaps).toHaveLength(0);
  });

  it("skips opaque entities", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [makeEntity("public.legacy", "opaque")]);

    const { report } = await runRlsCheck(ctx);

    expect(report.entitiesChecked).toBe(0);
    expect(report.gaps).toHaveLength(0);
  });

  it("warns on SECURITY DEFINER function without search_path", async () => {
    const { ctx } = makeTempCtx();
    const fn: FunctionNode = {
      id: "public.get_secret",
      schema: "public",
      name: "get_secret",
      args: [],
      returnType: "text",
      language: "plpgsql",
      security: "definer",
      volatility: "stable",
      // No searchPath
      managedStatus: "managed",
      confidence: 0.9,
    };
    writeIntentGraph(ctx, [], [], [fn]);

    const { report } = await runRlsCheck(ctx);

    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]?.code).toBe("DEFINER_NO_SEARCH_PATH");
    expect(report.warnings[0]?.entityId).toBe("public.get_secret");
  });

  it("does not warn on SECURITY DEFINER with explicit search_path", async () => {
    const { ctx } = makeTempCtx();
    const fn: FunctionNode = {
      id: "public.get_data",
      schema: "public",
      name: "get_data",
      args: [],
      returnType: "text",
      language: "sql",
      security: "definer",
      volatility: "stable",
      searchPath: ["public", "pg_temp"],
      managedStatus: "managed",
      confidence: 0.9,
    };
    writeIntentGraph(ctx, [], [], [fn]);

    const { report } = await runRlsCheck(ctx);

    expect(report.warnings).toHaveLength(0);
  });

  it("throws MISSING_ARTIFACT when intent graph not found", async () => {
    const { ctx } = makeTempCtx();

    await expect(runRlsCheck(ctx)).rejects.toMatchObject({ code: "MISSING_ARTIFACT" });
  });

  it("writes both artifacts to disk", async () => {
    const { ctx } = makeTempCtx();
    writeIntentGraph(ctx, [makeEntity("public.users")], [makePolicy("public.users", "SELECT")]);

    await runRlsCheck(ctx);

    const planEnv = readArtifactOrNull<RlsPlanData>(
      ctx,
      STUDIO_ARTIFACTS.RLS_PLAN.id,
      STUDIO_ARTIFACTS.RLS_PLAN.version
    );
    const reportEnv = readArtifactOrNull<RlsReportData>(
      ctx,
      STUDIO_ARTIFACTS.RLS_REPORT.id,
      STUDIO_ARTIFACTS.RLS_REPORT.version
    );

    expect(planEnv?.data).toBeDefined();
    expect(reportEnv?.data).toBeDefined();
  });
});


