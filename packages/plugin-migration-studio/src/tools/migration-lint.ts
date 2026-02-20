/**
 * Migration file linter.
 *
 * Reads the studio.sql.ast artifact (produced by studio-sql-parse) and applies
 * static analysis rules to each parsed migration file:
 *
 *   TRUNCATE_DETECTED          (error)   — TRUNCATE is almost never safe in a migration
 *   DESTRUCTIVE_NO_TRANSACTION (warning) — DROP/ALTER without a wrapping transaction
 *   DROP_DETECTED              (warning) — DROP TABLE / DROP COLUMN is irreversible
 *   LOW_PARSE_CONFIDENCE       (info)    — parser couldn't fully model the SQL
 *   NAMING_VIOLATION           (warning) — filename missing 14-digit timestamp prefix
 *
 * Produces: studio.migration.lint
 */
import type { PluginContext } from "@sbtools/sdk";
import { readArtifactOrNull } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../artifacts/constants.js";
import { writeMigrationLintArtifact } from "../artifacts/writers.js";
import type { LintFinding, MigrationLintData } from "../artifacts/writers.js";
import type { SqlAstData } from "../artifacts/writers.js";

// ---------------------------------------------------------------------------
// Lint rules
// ---------------------------------------------------------------------------

const TIMESTAMP_PREFIX_RE = /^\d{14}_/;

function lintFile(
  filename: string,
  riskMeta: SqlAstData["files"][number]["riskMeta"]
): LintFinding[] {
  const findings: LintFinding[] = [];
  const { riskFlags, confidence } = riskMeta;

  if (riskFlags.hasTruncate) {
    findings.push({
      code: "TRUNCATE_DETECTED",
      severity: "error",
      message: `${filename}: TRUNCATE detected — this is rarely appropriate in a migration and may cause data loss`,
      objectId: filename,
    });
  }

  if (riskFlags.hasDrop) {
    findings.push({
      code: "DROP_DETECTED",
      severity: "warning",
      message: `${filename}: DROP statement detected — ensure the column/table is no longer needed before applying`,
      objectId: filename,
    });
  }

  if (riskFlags.hasDestructive && !riskFlags.hasTransaction) {
    findings.push({
      code: "DESTRUCTIVE_NO_TRANSACTION",
      severity: "warning",
      message: `${filename}: destructive operation without a wrapping transaction — wrap in BEGIN/COMMIT to allow rollback`,
      objectId: filename,
    });
  }

  if (confidence === "low") {
    findings.push({
      code: "LOW_PARSE_CONFIDENCE",
      severity: "info",
      message: `${filename}: low parse confidence — some SQL could not be fully modeled; review manually`,
      objectId: filename,
    });
  }

  if (!TIMESTAMP_PREFIX_RE.test(filename)) {
    findings.push({
      code: "NAMING_VIOLATION",
      severity: "warning",
      message: `${filename}: migration filename should start with a 14-digit timestamp prefix (YYYYMMDDHHmmss_)`,
      objectId: filename,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runMigrationLint(ctx: PluginContext): Promise<MigrationLintData> {
  const astEnv = readArtifactOrNull<SqlAstData>(
    ctx,
    STUDIO_ARTIFACTS.SQL_AST.id,
    STUDIO_ARTIFACTS.SQL_AST.version
  );
  if (!astEnv?.data) {
    throw Object.assign(
      new Error("studio.sql.ast artifact not found. Run studio-sql-parse first."),
      { code: "MISSING_ARTIFACT" }
    );
  }

  const lintedAt = new Date().toISOString();
  const allFindings: LintFinding[] = [];

  for (const file of astEnv.data.files) {
    const fileFindings = lintFile(file.filename, file.riskMeta);
    allFindings.push(...fileFindings);
  }

  const errorCount = allFindings.filter((f) => f.severity === "error").length;
  const warningCount = allFindings.filter((f) => f.severity === "warning").length;
  const infoCount = allFindings.filter((f) => f.severity === "info").length;

  const result: MigrationLintData = {
    lintedAt,
    status: errorCount === 0 ? "pass" : "fail",
    findings: allFindings,
    errorCount,
    warningCount,
    infoCount,
  };

  writeMigrationLintArtifact(ctx, result);

  return result;
}
