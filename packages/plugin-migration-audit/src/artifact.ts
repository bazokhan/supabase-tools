/**
 * Produces the migration.analysis versioned artifact.
 * Written whenever audit completes so consumers can read the canonical result.
 */
import { createArtifactWriter } from "@sbtools/sdk";
import type { MigrationSqlAnalysis } from "@sbtools/sdk";
import type { PluginContext } from "@sbtools/sdk";
import type { AuditResult } from "./types.js";

/** Schema version for migration.analysis artifact. */
export const MIGRATION_ANALYSIS_VERSION = "1.0.0";

/** Serialize AuditResult for artifact storage (dates → ISO strings). */
function toArtifactData(result: AuditResult): MigrationAnalysisArtifactData {
  return {
    auditedAt: result.auditedAt,
    migrationsDir: result.migrationsDir,
    trackingTableExists: result.trackingTableExists,
    databaseReachable: result.databaseReachable,
    migrations: result.migrations.map((m) => ({
      filename: m.filename,
      status: m.status,
      timestampPrefix: m.timestampPrefix,
      appliedAt: m.appliedAt?.toISOString() ?? null,
      sizeBytes: m.sizeBytes,
      fileModifiedAt: m.fileModifiedAt?.toISOString() ?? null,
      filePath: m.filePath,
      sqlAnalysis: m.sqlAnalysis,
    })),
    issues: result.issues,
    summary: result.summary,
    schema: result.schema,
  };
}

/** Data shape stored in migration.analysis artifact (dates as ISO strings). */
export interface MigrationAnalysisArtifactData {
  auditedAt: string;
  migrationsDir: string;
  trackingTableExists: boolean;
  databaseReachable: boolean;
  migrations: Array<{
    filename: string;
    status: string;
    timestampPrefix: string | null;
    appliedAt: string | null;
    sizeBytes: number;
    fileModifiedAt: string | null;
    filePath: string;
    sqlAnalysis?: MigrationSqlAnalysis;
  }>;
  issues: Array<{ severity: string; code: string; message: string; affectedMigrations?: string[] }>;
  summary: {
    total: number;
    applied: number;
    pending: number;
    missing: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  schema: {
    publicTableCount: number;
    publicTableNames: string[];
    schemas: string[];
    functionCount: number;
    triggerCount: number;
    policyCount: number;
    viewCount: number;
    dbSize: string | null;
    pgVersion: string | null;
  } | null;
}

const writeMigrationAnalysisFn = createArtifactWriter<MigrationAnalysisArtifactData>({
  id: "migration.analysis",
  version: MIGRATION_ANALYSIS_VERSION,
  producer: "@sbtools/plugin-migration-audit",
});

/**
 * Write the migration.analysis artifact after an audit completes.
 * Call this from any code path that produces an AuditResult.
 */
export function writeMigrationAnalysisArtifact(
  ctx: PluginContext,
  result: AuditResult,
  opts?: { sourceHash?: string; snapshotHash?: string; pluginVersion?: string }
): void {
  writeMigrationAnalysisFn(ctx, toArtifactData(result), {
    generatedAt: result.auditedAt,
    inputs: {
      migrationsDir: result.migrationsDir,
      ...(opts?.sourceHash && { sourceHash: opts.sourceHash }),
      ...(opts?.snapshotHash && { snapshotHash: opts.snapshotHash }),
    },
    meta: { toolVersion: opts?.pluginVersion ?? "unknown" },
  });
}
