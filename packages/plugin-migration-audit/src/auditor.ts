/**
 * Core audit logic: compare disk vs DB, detect issues.
 */
import type {
  MigrationFile,
  AppliedMigration,
  MigrationEntry,
  MigrationStatus,
  AuditIssue,
  AuditResult,
  AuditSummary,
  SchemaSnapshot,
} from "./types.js";
import { parseTimestampPrefix } from "./migration-scanner.js";

export const ISSUE_CODES = {
  MISSING_FILE: "MISSING_FILE",
  PENDING_MIGRATION: "PENDING_MIGRATION",
  NO_TRACKING_TABLE: "NO_TRACKING_TABLE",
  ORDERING_GAP: "ORDERING_GAP",
  TIMESTAMP_PARSE_FAILURE: "TIMESTAMP_PARSE_FAILURE",
  EMPTY_MIGRATION: "EMPTY_MIGRATION",
} as const;

export interface BuildAuditResultOpts {
  migrationsDir: string;
  files: MigrationFile[];
  applied: AppliedMigration[];
  trackingTableExists: boolean;
  databaseReachable: boolean;
  schema: SchemaSnapshot | null;
}

/**
 * Build the full audit result by merging disk files and DB records.
 */
export function buildAuditResult(opts: BuildAuditResultOpts): AuditResult {
  const {
    migrationsDir,
    files,
    applied,
    trackingTableExists,
    databaseReachable,
    schema,
  } = opts;

  const appliedByVersion = new Map<string, AppliedMigration>();
  for (const a of applied) {
    appliedByVersion.set(a.version, a);
  }

  const filesByFilename = new Map<string, MigrationFile>();
  for (const f of files) {
    filesByFilename.set(f.filename, f);
  }

  const entries: MigrationEntry[] = [];

  // Entries from disk
  for (const f of files) {
    const rec = appliedByVersion.get(f.filename);
    const status: MigrationStatus = rec ? "applied" : "pending";
    entries.push({
      filename: f.filename,
      status,
      timestampPrefix: f.timestampPrefix,
      appliedAt: rec?.appliedAt ?? null,
      sizeBytes: f.sizeBytes,
      fileModifiedAt: f.modifiedAt,
      filePath: f.filePath,
    });
  }

  // Entries from DB (not on disk) — missing
  for (const [version, rec] of appliedByVersion) {
    if (!filesByFilename.has(version)) {
      entries.push({
        filename: version,
        status: "missing",
        timestampPrefix: parseTimestampPrefix(version),
        appliedAt: rec.appliedAt,
        sizeBytes: 0,
        fileModifiedAt: null,
        filePath: "",
      });
    }
  }

  // Sort by filename for consistent output
  entries.sort((a, b) => a.filename.localeCompare(b.filename));

  const issues = detectIssues(entries, applied, trackingTableExists, databaseReachable);

  const summary: AuditSummary = {
    total: entries.length,
    applied: entries.filter((e) => e.status === "applied").length,
    pending: entries.filter((e) => e.status === "pending").length,
    missing: entries.filter((e) => e.status === "missing").length,
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    infos: issues.filter((i) => i.severity === "info").length,
  };

  return {
    auditedAt: new Date().toISOString(),
    migrationsDir,
    trackingTableExists,
    databaseReachable,
    migrations: entries,
    issues,
    summary,
    schema,
  };
}

/**
 * Detect audit issues from entries and applied migrations.
 */
export function detectIssues(
  entries: MigrationEntry[],
  applied: AppliedMigration[],
  trackingTableExists: boolean,
  databaseReachable: boolean
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (databaseReachable && !trackingTableExists) {
    issues.push({
      severity: "warning",
      code: ISSUE_CODES.NO_TRACKING_TABLE,
      message: "app_migrations.schema_migrations table does not exist",
    });
  }

  const missing = entries.filter((e) => e.status === "missing");
  if (missing.length > 0) {
    issues.push({
      severity: "error",
      code: ISSUE_CODES.MISSING_FILE,
      message: `${missing.length} migration(s) applied in DB but file(s) missing on disk`,
      affectedMigrations: missing.map((e) => e.filename),
    });
  }

  const pending = entries.filter((e) => e.status === "pending");
  if (pending.length > 0) {
    issues.push({
      severity: "warning",
      code: ISSUE_CODES.PENDING_MIGRATION,
      message: `${pending.length} migration file(s) not yet applied`,
      affectedMigrations: pending.map((e) => e.filename),
    });
  }

  // ORDERING_GAP: applied out of chronological order (by timestamp prefix)
  const appliedWithTs = applied
    .map((a) => ({ ...a, ts: parseTimestampPrefix(a.version) }))
    .filter((a) => a.ts != null) as { version: string; appliedAt: Date; ts: string }[];

  if (appliedWithTs.length >= 2) {
    const byAppliedAt = [...appliedWithTs].sort(
      (a, b) => a.appliedAt.getTime() - b.appliedAt.getTime()
    );
    for (let i = 1; i < byAppliedAt.length; i++) {
      if (byAppliedAt[i].ts < byAppliedAt[i - 1].ts) {
        issues.push({
          severity: "warning",
          code: ISSUE_CODES.ORDERING_GAP,
          message: "Migrations were applied out of chronological order (by filename timestamp)",
          affectedMigrations: [byAppliedAt[i - 1].version, byAppliedAt[i].version],
        });
        break; // One issue is enough
      }
    }
  }

  // TIMESTAMP_PARSE_FAILURE: non-standard filename (no timestamp prefix)
  const noTs = entries.filter((e) => e.status !== "missing" && e.timestampPrefix == null);
  if (noTs.length > 0) {
    issues.push({
      severity: "info",
      code: ISSUE_CODES.TIMESTAMP_PARSE_FAILURE,
      message: `${noTs.length} migration(s) with non-standard filename (no YYYYMMDDHHMMSS prefix)`,
      affectedMigrations: noTs.map((e) => e.filename),
    });
  }

  // EMPTY_MIGRATION: 0-byte files
  const empty = entries.filter((e) => e.sizeBytes === 0 && e.status !== "missing");
  if (empty.length > 0) {
    issues.push({
      severity: "info",
      code: ISSUE_CODES.EMPTY_MIGRATION,
      message: `${empty.length} empty migration file(s) (0 bytes)`,
      affectedMigrations: empty.map((e) => e.filename),
    });
  }

  return issues;
}
