/**
 * Tests for migration-lint tool.
 */
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { writeArtifact, readArtifactOrNull } from "@sbtools/sdk";
import type { PluginContext } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../src/artifacts/constants.js";
import { runMigrationLint } from "../../src/tools/core/studio-migration-lint.core.js";
import type { SqlAstData, MigrationLintData } from "../../src/artifacts/writers.js";

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-migration-lint-test-"));
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

function makeRiskMeta(overrides: Partial<SqlAstData["files"][number]["riskMeta"]> = {}): SqlAstData["files"][number]["riskMeta"] {
  return {
    operations: [],
    touchedObjectKeys: [],
    riskFlags: {
      hasTransaction: false,
      hasDestructive: false,
      hasIfExists: false,
      hasIfNotExists: false,
      hasTruncate: false,
      hasDrop: false,
      ...overrides.riskFlags,
    },
    confidence: "high",
    ...overrides,
  };
}

function writeSqlAst(ctx: PluginContext, files: Array<{ filename: string; riskMeta: SqlAstData["files"][number]["riskMeta"] }>) {
  const data: SqlAstData = {
    migrationsDir: "/migrations",
    parsedAt: new Date().toISOString(),
    files: files.map((f) => ({
      filename: f.filename,
      nodeTypes: [],
      statementCount: 1,
      opaqueBlockCount: 0,
      touchedObjects: [],
      riskMeta: f.riskMeta,
      opaqueBlocks: [],
      entities: [],
      policies: [],
      functions: [],
      views: [],
      triggers: [],
      infrastructure: [],
    })),
    totalStatements: files.length,
    totalOpaqueBlocks: 0,
    allEntities: [],
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

describe("runMigrationLint", () => {
  it("passes with no findings for clean migrations", async () => {
    const { ctx } = makeTempCtx();
    writeSqlAst(ctx, [
      { filename: "20240101120000_init.sql", riskMeta: makeRiskMeta({ confidence: "high" }) },
    ]);

    const result = await runMigrationLint(ctx);

    expect(result.status).toBe("pass");
    expect(result.findings).toHaveLength(0);
    expect(result.errorCount).toBe(0);
  });

  it("produces error for TRUNCATE_DETECTED", async () => {
    const { ctx } = makeTempCtx();
    writeSqlAst(ctx, [
      {
        filename: "20240101120000_bad.sql",
        riskMeta: makeRiskMeta({ riskFlags: { hasTransaction: false, hasDestructive: true, hasTruncate: true, hasDrop: false, hasIfExists: false, hasIfNotExists: false } }),
      },
    ]);

    const result = await runMigrationLint(ctx);

    expect(result.status).toBe("fail");
    expect(result.errorCount).toBe(1);
    const truncateFinding = result.findings.find((f) => f.code === "TRUNCATE_DETECTED");
    expect(truncateFinding).toBeDefined();
    expect(truncateFinding?.severity).toBe("error");
  });

  it("produces warning for DROP_DETECTED", async () => {
    const { ctx } = makeTempCtx();
    writeSqlAst(ctx, [
      {
        filename: "20240101120000_drop.sql",
        riskMeta: makeRiskMeta({ riskFlags: { hasTransaction: true, hasDestructive: true, hasTruncate: false, hasDrop: true, hasIfExists: false, hasIfNotExists: false } }),
      },
    ]);

    const result = await runMigrationLint(ctx);

    expect(result.status).toBe("pass"); // only warnings, no errors
    const dropFinding = result.findings.find((f) => f.code === "DROP_DETECTED");
    expect(dropFinding?.severity).toBe("warning");
  });

  it("warns on DESTRUCTIVE_NO_TRANSACTION", async () => {
    const { ctx } = makeTempCtx();
    writeSqlAst(ctx, [
      {
        filename: "20240101120000_danger.sql",
        riskMeta: makeRiskMeta({
          riskFlags: { hasTransaction: false, hasDestructive: true, hasTruncate: false, hasDrop: false, hasIfExists: false, hasIfNotExists: false },
        }),
      },
    ]);

    const result = await runMigrationLint(ctx);

    const finding = result.findings.find((f) => f.code === "DESTRUCTIVE_NO_TRANSACTION");
    expect(finding?.severity).toBe("warning");
  });

  it("produces info for LOW_PARSE_CONFIDENCE", async () => {
    const { ctx } = makeTempCtx();
    writeSqlAst(ctx, [
      {
        filename: "20240101120000_complex.sql",
        riskMeta: makeRiskMeta({ confidence: "low" }),
      },
    ]);

    const result = await runMigrationLint(ctx);

    const finding = result.findings.find((f) => f.code === "LOW_PARSE_CONFIDENCE");
    expect(finding?.severity).toBe("info");
  });

  it("warns on NAMING_VIOLATION for non-timestamped filenames", async () => {
    const { ctx } = makeTempCtx();
    writeSqlAst(ctx, [
      { filename: "init.sql", riskMeta: makeRiskMeta() },
    ]);

    const result = await runMigrationLint(ctx);

    const finding = result.findings.find((f) => f.code === "NAMING_VIOLATION");
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("warning");
  });

  it("aggregates findings from multiple files", async () => {
    const { ctx } = makeTempCtx();
    writeSqlAst(ctx, [
      {
        filename: "20240101120000_a.sql",
        riskMeta: makeRiskMeta({ riskFlags: { hasTransaction: false, hasDestructive: true, hasTruncate: false, hasDrop: false, hasIfExists: false, hasIfNotExists: false } }),
      },
      {
        filename: "20240101120001_b.sql",
        riskMeta: makeRiskMeta({ riskFlags: { hasTransaction: true, hasDestructive: false, hasTruncate: false, hasDrop: true, hasIfExists: false, hasIfNotExists: false } }),
      },
    ]);

    const result = await runMigrationLint(ctx);

    expect(result.findings.length).toBeGreaterThanOrEqual(2);
  });

  it("throws MISSING_ARTIFACT when sql.ast not found", async () => {
    const { ctx } = makeTempCtx();

    await expect(runMigrationLint(ctx)).rejects.toMatchObject({ code: "MISSING_ARTIFACT" });
  });

  it("writes artifact to disk", async () => {
    const { ctx } = makeTempCtx();
    writeSqlAst(ctx, [{ filename: "20240101120000_init.sql", riskMeta: makeRiskMeta() }]);

    await runMigrationLint(ctx);

    const env = readArtifactOrNull<MigrationLintData>(
      ctx,
      STUDIO_ARTIFACTS.MIGRATION_LINT.id,
      STUDIO_ARTIFACTS.MIGRATION_LINT.version
    );
    expect(env?.data).toBeDefined();
    expect(env?.data.lintedAt).toBeTruthy();
  });
});


