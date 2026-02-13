/**
 * Types for the migration audit plugin.
 * Types only — no runtime code.
 */

/** Disk file info for a migration. */
export interface MigrationFile {
  filename: string;
  filePath: string;
  sizeBytes: number;
  modifiedAt: Date;
  timestampPrefix: string | null;
}

/** DB record from app_migrations.schema_migrations. */
export interface AppliedMigration {
  version: string;
  appliedAt: Date;
}

/** Migration status relative to disk and DB. */
export type MigrationStatus = "applied" | "pending" | "missing";

/** Combined disk + DB entry for a migration. */
export interface MigrationEntry {
  filename: string;
  status: MigrationStatus;
  timestampPrefix: string | null;
  appliedAt: Date | null;
  sizeBytes: number;
  fileModifiedAt: Date | null;
  filePath: string;
}

/** Audit issue severity. */
export type AuditIssueSeverity = "error" | "warning" | "info";

/** A detected audit issue. */
export interface AuditIssue {
  severity: AuditIssueSeverity;
  code: string;
  message: string;
  affectedMigrations?: string[];
}

/** DB schema metadata snapshot. */
export interface SchemaSnapshot {
  publicTableCount: number;
  publicTableNames: string[];
  schemas: string[];
  functionCount: number;
  triggerCount: number;
  policyCount: number;
  viewCount: number;
  dbSize: string | null;
  pgVersion: string | null;
}

/** Summary counts for the audit. */
export interface AuditSummary {
  total: number;
  applied: number;
  pending: number;
  missing: number;
  errors: number;
  warnings: number;
  infos: number;
}

/** Full audit result. */
export interface AuditResult {
  auditedAt: string;
  migrationsDir: string;
  trackingTableExists: boolean;
  databaseReachable: boolean;
  migrations: MigrationEntry[];
  issues: AuditIssue[];
  summary: AuditSummary;
  schema: SchemaSnapshot | null;
}
