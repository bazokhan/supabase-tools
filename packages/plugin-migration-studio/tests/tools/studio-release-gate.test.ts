/**
 * Tests for release-gate tool.
 */
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { writeArtifact, readArtifactOrNull } from "@sbtools/sdk";
import type { PluginContext } from "@sbtools/sdk";
import type { ReleaseGate } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../src/artifacts/constants.js";
import { runReleaseGate } from "../../src/tools/core/studio-release-gate.core.js";
import type {
  RlsReportData,
  RpcPlanData,
  MigrationLintData,
} from "../../src/artifacts/writers.js";

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-release-gate-test-"));
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

function writeRlsReport(ctx: PluginContext, data: Partial<RlsReportData>) {
  const full: RlsReportData = {
    checkedAt: new Date().toISOString(),
    status: "pass",
    gaps: [],
    warnings: [],
    entitiesChecked: 1,
    tablesWithRls: 1,
    tablesWithoutRls: 0,
    ...data,
  };
  writeArtifact(ctx, {
    id: STUDIO_ARTIFACTS.RLS_REPORT.id,
    version: STUDIO_ARTIFACTS.RLS_REPORT.version,
    producer: "test",
    generatedAt: new Date().toISOString(),
    data: full,
  });
}

function writeRpcPlan(ctx: PluginContext, data: Partial<RpcPlanData>) {
  const full: RpcPlanData = {
    generatedAt: new Date().toISOString(),
    functions: [],
    securityDefinerCount: 0,
    missingSearchPathCount: 0,
    ...data,
  };
  writeArtifact(ctx, {
    id: STUDIO_ARTIFACTS.RPC_PLAN.id,
    version: STUDIO_ARTIFACTS.RPC_PLAN.version,
    producer: "test",
    generatedAt: new Date().toISOString(),
    data: full,
  });
}

function writeMigrationLint(ctx: PluginContext, data: Partial<MigrationLintData>) {
  const full: MigrationLintData = {
    lintedAt: new Date().toISOString(),
    status: "pass",
    findings: [],
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
    ...data,
  };
  writeArtifact(ctx, {
    id: STUDIO_ARTIFACTS.MIGRATION_LINT.id,
    version: STUDIO_ARTIFACTS.MIGRATION_LINT.version,
    producer: "test",
    generatedAt: new Date().toISOString(),
    data: full,
  });
}

describe("runReleaseGate", () => {
  it("fails with NO_VALIDATION when no artifacts exist", async () => {
    const { ctx } = makeTempCtx();

    const gate = await runReleaseGate(ctx);

    expect(gate.status).toBe("fail");
    expect(gate.blocking.some((b) => b.code === "NO_VALIDATION")).toBe(true);
    expect(gate.evidence).toHaveLength(0);
  });

  it("passes when all validation artifacts are clean", async () => {
    const { ctx } = makeTempCtx();
    writeRlsReport(ctx, { status: "pass", gaps: [] });
    writeRpcPlan(ctx, { functions: [], missingSearchPathCount: 0 });
    writeMigrationLint(ctx, { status: "pass", findings: [] });

    const gate = await runReleaseGate(ctx);

    expect(gate.status).toBe("pass");
    expect(gate.blocking).toHaveLength(0);
    expect(gate.evidence).toHaveLength(3);
  });

  it("fails when RLS report has gaps", async () => {
    const { ctx } = makeTempCtx();
    writeRlsReport(ctx, {
      status: "fail",
      gaps: [{ entityId: "public.users", missingCommands: ["SELECT", "INSERT"], reason: "no policies" }],
    });

    const gate = await runReleaseGate(ctx);

    expect(gate.status).toBe("fail");
    const rlsBlock = gate.blocking.find((b) => b.code === "RLS_GAP");
    expect(rlsBlock).toBeDefined();
    expect(rlsBlock?.severity).toBe("error");
    expect(rlsBlock?.message).toContain("public.users");
  });

  it("fails when migration lint has errors", async () => {
    const { ctx } = makeTempCtx();
    writeRlsReport(ctx, { status: "pass", gaps: [] });
    writeMigrationLint(ctx, {
      status: "fail",
      findings: [{ code: "TRUNCATE_DETECTED", severity: "error", message: "TRUNCATE found" }],
      errorCount: 1,
    });

    const gate = await runReleaseGate(ctx);

    expect(gate.status).toBe("fail");
    const lintBlock = gate.blocking.find((b) => b.code === "TRUNCATE_DETECTED");
    expect(lintBlock).toBeDefined();
  });

  it("passes but includes warnings from lint", async () => {
    const { ctx } = makeTempCtx();
    writeRlsReport(ctx, { status: "pass", gaps: [] });
    writeMigrationLint(ctx, {
      status: "pass",
      findings: [{ code: "DROP_DETECTED", severity: "warning", message: "DROP found" }],
      warningCount: 1,
    });

    const gate = await runReleaseGate(ctx);

    expect(gate.status).toBe("pass");
    expect(gate.blocking).toHaveLength(0);
    expect(gate.warnings.some((w) => w.code === "DROP_DETECTED")).toBe(true);
  });

  it("includes warnings from RLS report (DEFINER_NO_SEARCH_PATH)", async () => {
    const { ctx } = makeTempCtx();
    writeRlsReport(ctx, {
      status: "pass",
      gaps: [],
      warnings: [{ entityId: "public.fn", message: "DEFINER without search_path", code: "DEFINER_NO_SEARCH_PATH" }],
    });

    const gate = await runReleaseGate(ctx);

    expect(gate.warnings.some((w) => w.code === "DEFINER_NO_SEARCH_PATH")).toBe(true);
  });

  it("propagates warnings from RPC plan function lint", async () => {
    const { ctx } = makeTempCtx();
    writeRlsReport(ctx, { status: "pass", gaps: [] });
    writeRpcPlan(ctx, {
      functions: [
        {
          functionId: "public.risky_fn",
          schema: "public",
          name: "risky_fn",
          security: "definer",
          hasSearchPath: false,
          hasInputValidation: false,
          lintWarnings: ["DEFINER_NO_SEARCH_PATH: missing search_path"],
        },
      ],
      securityDefinerCount: 1,
      missingSearchPathCount: 1,
    });

    const gate = await runReleaseGate(ctx);

    expect(gate.warnings.some((w) => w.code === "DEFINER_NO_SEARCH_PATH")).toBe(true);
  });

  it("writes gate artifact to disk", async () => {
    const { ctx } = makeTempCtx();
    writeRlsReport(ctx, { status: "pass", gaps: [] });

    await runReleaseGate(ctx);

    const env = readArtifactOrNull<ReleaseGate>(
      ctx,
      STUDIO_ARTIFACTS.RELEASE_GATE.id,
      STUDIO_ARTIFACTS.RELEASE_GATE.version
    );
    expect(env?.data).toBeDefined();
    expect(env?.data.snapshotHash).toBeTruthy();
  });

  it("collects evidence from all available artifacts", async () => {
    const { ctx } = makeTempCtx();
    writeRlsReport(ctx, { status: "pass", gaps: [] });
    writeRpcPlan(ctx, {});
    writeMigrationLint(ctx, {});

    const gate = await runReleaseGate(ctx);

    expect(gate.evidence).toHaveLength(3);
    const evidenceIds = gate.evidence.map((e) => e.id);
    expect(evidenceIds).toContain(STUDIO_ARTIFACTS.RLS_REPORT.id);
    expect(evidenceIds).toContain(STUDIO_ARTIFACTS.RPC_PLAN.id);
    expect(evidenceIds).toContain(STUDIO_ARTIFACTS.MIGRATION_LINT.id);
  });
});


