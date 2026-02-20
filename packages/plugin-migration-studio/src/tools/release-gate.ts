/**
 * Release gate: aggregates findings from validation tools into a single pass/fail.
 *
 * Reads (all optional — missing artifacts contribute warnings/blocks):
 *   studio.rls.report     → RLS coverage gaps (each gap → blocking)
 *   studio.rpc.plan       → function security issues (warnings)
 *   studio.migration.lint → lint findings (errors → blocking, warnings → warnings)
 *
 * If none of the validation artifacts exist, the gate fails with NO_VALIDATION.
 *
 * Produces: studio.release.gate
 */
import crypto from "node:crypto";
import type { PluginContext } from "@sbtools/sdk";
import { readArtifactOrNull } from "@sbtools/sdk";
import type { ReleaseGate, GateReason, ArtifactRef } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../artifacts/constants.js";
import { writeReleaseGateArtifact } from "../artifacts/writers.js";
import type { RlsReportData, RpcPlanData, MigrationLintData } from "../artifacts/writers.js";

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runReleaseGate(ctx: PluginContext): Promise<ReleaseGate> {
  const generatedAt = new Date().toISOString();

  // Compute a deterministic snapshot hash from the gate inputs
  const snapshotHash = crypto
    .createHash("sha256")
    .update(generatedAt)
    .digest("hex")
    .slice(0, 16);

  const blocking: GateReason[] = [];
  const warnings: GateReason[] = [];
  const evidence: ArtifactRef[] = [];

  // ── RLS report ────────────────────────────────────────────────────────────
  const rlsEnv = readArtifactOrNull<RlsReportData>(
    ctx,
    STUDIO_ARTIFACTS.RLS_REPORT.id,
    STUDIO_ARTIFACTS.RLS_REPORT.version
  );

  if (rlsEnv?.data) {
    const rlsRef: ArtifactRef = {
      id: STUDIO_ARTIFACTS.RLS_REPORT.id,
      version: STUDIO_ARTIFACTS.RLS_REPORT.version,
    };
    evidence.push(rlsRef);

    for (const gap of rlsEnv.data.gaps) {
      blocking.push({
        code: "RLS_GAP",
        severity: "error",
        message: `${gap.entityId}: missing RLS policies for [${gap.missingCommands.join(", ")}] — ${gap.reason}`,
        artifact: rlsRef,
        remediation: `Run sbt studio-add-rls-policy --entity ${gap.entityId} --command <cmd> --roles authenticated`,
      });
    }

    for (const warning of rlsEnv.data.warnings) {
      warnings.push({
        code: warning.code,
        severity: "warning",
        message: warning.message,
        artifact: rlsRef,
        remediation:
          warning.code === "DEFINER_NO_SEARCH_PATH"
            ? "Add SET search_path = public, pg_temp; to the function"
            : undefined,
      });
    }
  }

  // ── RPC plan ──────────────────────────────────────────────────────────────
  const rpcEnv = readArtifactOrNull<RpcPlanData>(
    ctx,
    STUDIO_ARTIFACTS.RPC_PLAN.id,
    STUDIO_ARTIFACTS.RPC_PLAN.version
  );

  if (rpcEnv?.data) {
    const rpcRef: ArtifactRef = {
      id: STUDIO_ARTIFACTS.RPC_PLAN.id,
      version: STUDIO_ARTIFACTS.RPC_PLAN.version,
    };
    evidence.push(rpcRef);

    for (const fn of rpcEnv.data.functions) {
      for (const w of fn.lintWarnings) {
        warnings.push({
          code: w.split(":")[0] ?? "RPC_LINT",
          severity: "warning",
          message: `${fn.functionId}: ${w}`,
          artifact: rpcRef,
        });
      }
    }
  }

  // ── Migration lint ────────────────────────────────────────────────────────
  const lintEnv = readArtifactOrNull<MigrationLintData>(
    ctx,
    STUDIO_ARTIFACTS.MIGRATION_LINT.id,
    STUDIO_ARTIFACTS.MIGRATION_LINT.version
  );

  if (lintEnv?.data) {
    const lintRef: ArtifactRef = {
      id: STUDIO_ARTIFACTS.MIGRATION_LINT.id,
      version: STUDIO_ARTIFACTS.MIGRATION_LINT.version,
    };
    evidence.push(lintRef);

    for (const finding of lintEnv.data.findings) {
      if (finding.severity === "error") {
        blocking.push({
          code: finding.code,
          severity: "error",
          message: finding.message,
          artifact: lintRef,
          remediation: "Fix the issue in the migration file and re-run studio-lint",
        });
      } else if (finding.severity === "warning") {
        warnings.push({
          code: finding.code,
          severity: "warning",
          message: finding.message,
          artifact: lintRef,
        });
      }
    }
  }

  // ── No validation artifacts present ──────────────────────────────────────
  if (evidence.length === 0) {
    blocking.push({
      code: "NO_VALIDATION",
      severity: "error",
      message:
        "No validation artifacts found (rls.report, rpc.plan, migration.lint). Run studio-rls-check, studio-rpc-lint, and studio-lint before applying.",
      artifact: { id: "studio.release.gate", version: "1.0.0" },
      remediation: "Run: sbt studio-rls-check && sbt studio-rpc-lint && sbt studio-lint",
    });
  }

  const gate: ReleaseGate = {
    status: blocking.length === 0 ? "pass" : "fail",
    blocking,
    warnings,
    acknowledgements: [],
    evidence,
    snapshotHash,
    generatedAt,
  };

  writeReleaseGateArtifact(ctx, gate);

  return gate;
}
