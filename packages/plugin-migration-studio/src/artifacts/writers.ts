/**
 * Typed artifact writer factories for all Migration Studio artifacts.
 *
 * Each export follows the pattern from plugin-migration-audit/src/artifact.ts:
 * 1. Define a data interface for the artifact's `data` field.
 * 2. Create a typed writer with `createArtifactWriter<T>`.
 * 3. Export a named write function with a clear call site signature.
 *
 * These writers are the only way studio tools should persist artifacts —
 * never call `writeArtifact` directly from tool code.
 */
import { createArtifactWriter } from "@sbtools/sdk";
import type { PluginContext } from "@sbtools/sdk";
import type {
  IntentGraph,
  WorkflowRun,
  ReleaseGate,
  OpaqueBlock,
  EntityNode,
  ViewNode,
  FunctionNode,
  PolicyNode,
  TriggerNode,
  InfraNode,
} from "@sbtools/sdk";
import type { MigrationSqlAnalysis } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "./constants.js";

// ---------------------------------------------------------------------------
// studio.schema.snapshot
// ---------------------------------------------------------------------------

/** Structured snapshot of the live database schema, produced by studio-introspect. */
export interface SchemaSnapshotData {
  capturedAt: string;
  pgVersion?: string;
  connectionUrl?: string;
  /** Full entity nodes from the live DB (tables with columns, constraints, indexes). */
  entities: EntityNode[];
  views: ViewNode[];
  functions: FunctionNode[];
  policies: PolicyNode[];
  triggers: TriggerNode[];
  /** Extensions and other infrastructure discovered in the DB. */
  infrastructure: InfraNode[];
}

const _writeSchemaSnapshot = createArtifactWriter<SchemaSnapshotData>({
  id: STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id,
  version: STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.version,
  producer: "@sbtools/plugin-migration-studio",
});

export function writeSchemaSnapshotArtifact(
  ctx: PluginContext,
  data: SchemaSnapshotData,
  opts?: { sourceHash?: string }
): void {
  _writeSchemaSnapshot(ctx, data, {
    inputs: opts?.sourceHash ? { sourceHash: opts.sourceHash } : undefined,
  });
}

// ---------------------------------------------------------------------------
// studio.sql.ast
// ---------------------------------------------------------------------------

/** Per-file summary produced by studio-sql-parse. */
export interface SqlAstFileEntry {
  filename: string;
  /** Distinct libpg_query node types found (e.g., ['CreateStmt', 'IndexStmt']). */
  nodeTypes: string[];
  statementCount: number;
  opaqueBlockCount: number;
  /** Object keys touched by this file (from regex analyzer overlay). */
  touchedObjects: string[];
  riskMeta: MigrationSqlAnalysis;
  opaqueBlocks: OpaqueBlock[];
  /** Extracted intent nodes from this file's AST statements. */
  entities: Partial<EntityNode>[];
  policies: Partial<PolicyNode>[];
  functions: Partial<FunctionNode>[];
  views: Partial<ViewNode>[];
  triggers: Partial<TriggerNode>[];
  infrastructure: Partial<InfraNode>[];
}

export interface SqlAstData {
  migrationsDir: string;
  parsedAt: string;
  files: SqlAstFileEntry[];
  totalStatements: number;
  totalOpaqueBlocks: number;
  /** Merged node arrays across all files (for intent-sync convenience). */
  allEntities: Partial<EntityNode>[];
  allPolicies: Partial<PolicyNode>[];
  allFunctions: Partial<FunctionNode>[];
  allViews: Partial<ViewNode>[];
  allTriggers: Partial<TriggerNode>[];
  allInfrastructure: Partial<InfraNode>[];
}

const _writeSqlAst = createArtifactWriter<SqlAstData>({
  id: STUDIO_ARTIFACTS.SQL_AST.id,
  version: STUDIO_ARTIFACTS.SQL_AST.version,
  producer: "@sbtools/plugin-migration-studio",
});

export function writeSqlAstArtifact(
  ctx: PluginContext,
  data: SqlAstData,
  opts?: { migrationsHash?: string }
): void {
  _writeSqlAst(ctx, data, {
    generatedAt: data.parsedAt,
    inputs: opts?.migrationsHash ? { migrationsHash: opts.migrationsHash } : undefined,
  });
}

// ---------------------------------------------------------------------------
// studio.intent.graph
// ---------------------------------------------------------------------------

const _writeIntentGraph = createArtifactWriter<IntentGraph>({
  id: STUDIO_ARTIFACTS.INTENT_GRAPH.id,
  version: STUDIO_ARTIFACTS.INTENT_GRAPH.version,
  producer: "@sbtools/plugin-migration-studio",
});

export function writeIntentGraphArtifact(
  ctx: PluginContext,
  data: IntentGraph,
  opts?: { snapshotHash?: string; sourceHash?: string }
): void {
  _writeIntentGraph(ctx, data, {
    inputs: {
      ...(opts?.snapshotHash && { snapshotHash: opts.snapshotHash }),
      ...(opts?.sourceHash && { sourceHash: opts.sourceHash }),
    },
  });
}

// ---------------------------------------------------------------------------
// studio.intent.sync-report
// ---------------------------------------------------------------------------

/** Confidence-scored match between DB reality and intent graph. */
export interface IntentSyncData {
  syncedAt: string;
  /** Nodes matched between DB snapshot and intent graph. */
  matched: Array<{
    objectId: string;
    objectType: string;
    confidence: number;
    driftDetails?: string;
  }>;
  /** Objects in the DB snapshot with no intent node. */
  unmatchedDb: Array<{ objectId: string; objectType: string; reason: string }>;
  /** Intent graph nodes with no corresponding DB object. */
  unmatchedIntent: Array<{ objectId: string; objectType: string }>;
  summary: {
    matchedCount: number;
    unmatchedDbCount: number;
    unmatchedIntentCount: number;
    averageConfidence: number;
  };
}

const _writeIntentSync = createArtifactWriter<IntentSyncData>({
  id: STUDIO_ARTIFACTS.INTENT_SYNC.id,
  version: STUDIO_ARTIFACTS.INTENT_SYNC.version,
  producer: "@sbtools/plugin-migration-studio",
});

export function writeIntentSyncArtifact(
  ctx: PluginContext,
  data: IntentSyncData,
  opts?: { snapshotHash?: string }
): void {
  _writeIntentSync(ctx, data, {
    generatedAt: data.syncedAt,
    inputs: opts?.snapshotHash ? { snapshotHash: opts.snapshotHash } : undefined,
  });
}

// ---------------------------------------------------------------------------
// studio.rls.plan
// ---------------------------------------------------------------------------

export interface RlsPolicyEntry {
  entityId: string;
  policyName: string;
  command: string;
  roles: string[];
  usingSql: string;
  withCheckSql?: string;
  permissive: boolean;
  template?: string;
  generatedSql: string;
}

export interface RlsPlanData {
  generatedAt: string;
  policies: RlsPolicyEntry[];
  entitiesWithoutPolicies: string[];
}

const _writeRlsPlan = createArtifactWriter<RlsPlanData>({
  id: STUDIO_ARTIFACTS.RLS_PLAN.id,
  version: STUDIO_ARTIFACTS.RLS_PLAN.version,
  producer: "@sbtools/plugin-migration-studio",
});

export function writeRlsPlanArtifact(ctx: PluginContext, data: RlsPlanData): void {
  _writeRlsPlan(ctx, data, { generatedAt: data.generatedAt });
}

// ---------------------------------------------------------------------------
// studio.rls.report
// ---------------------------------------------------------------------------

export interface RlsGap {
  entityId: string;
  missingCommands: string[];
  reason: string;
}

export interface RlsReportData {
  checkedAt: string;
  status: "pass" | "fail";
  gaps: RlsGap[];
  warnings: Array<{ entityId: string; message: string; code: string }>;
  entitiesChecked: number;
  tablesWithRls: number;
  tablesWithoutRls: number;
}

const _writeRlsReport = createArtifactWriter<RlsReportData>({
  id: STUDIO_ARTIFACTS.RLS_REPORT.id,
  version: STUDIO_ARTIFACTS.RLS_REPORT.version,
  producer: "@sbtools/plugin-migration-studio",
});

export function writeRlsReportArtifact(ctx: PluginContext, data: RlsReportData): void {
  _writeRlsReport(ctx, data, { generatedAt: data.checkedAt });
}

// ---------------------------------------------------------------------------
// studio.rpc.plan
// ---------------------------------------------------------------------------

export interface RpcFunctionPlan {
  functionId: string;
  schema: string;
  name: string;
  security: string;
  hasSearchPath: boolean;
  hasInputValidation: boolean;
  lintWarnings: string[];
  generatedWrapper?: string;
}

export interface RpcPlanData {
  generatedAt: string;
  functions: RpcFunctionPlan[];
  securityDefinerCount: number;
  missingSearchPathCount: number;
}

const _writeRpcPlan = createArtifactWriter<RpcPlanData>({
  id: STUDIO_ARTIFACTS.RPC_PLAN.id,
  version: STUDIO_ARTIFACTS.RPC_PLAN.version,
  producer: "@sbtools/plugin-migration-studio",
});

export function writeRpcPlanArtifact(ctx: PluginContext, data: RpcPlanData): void {
  _writeRpcPlan(ctx, data, { generatedAt: data.generatedAt });
}

// ---------------------------------------------------------------------------
// studio.migration.plan
// ---------------------------------------------------------------------------

export type ChangeClass =
  | "additive_safe"
  | "additive_with_default"
  | "rename_expand_contract"
  | "type_change_widening"
  | "type_change_narrowing"
  | "drop"
  | "policy_change"
  | "constraint_change";

export interface MigrationChange {
  objectId: string;
  changeClass: ChangeClass;
  description: string;
  sql: string[];
  rollbackSql?: string[];
  requiresConfirmation: boolean;
}

export interface MigrationPlanData {
  generatedAt: string;
  snapshotHash: string;
  changes: MigrationChange[];
  outputFile?: string;
  totalChanges: number;
  destructiveCount: number;
  expandContractCount: number;
}

const _writeMigrationPlan = createArtifactWriter<MigrationPlanData>({
  id: STUDIO_ARTIFACTS.MIGRATION_PLAN.id,
  version: STUDIO_ARTIFACTS.MIGRATION_PLAN.version,
  producer: "@sbtools/plugin-migration-studio",
});

export function writeMigrationPlanArtifact(ctx: PluginContext, data: MigrationPlanData): void {
  _writeMigrationPlan(ctx, data, { generatedAt: data.generatedAt });
}

// ---------------------------------------------------------------------------
// studio.migration.lint
// ---------------------------------------------------------------------------

export interface LintFinding {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  objectId?: string;
  line?: number;
}

export interface MigrationLintData {
  lintedAt: string;
  status: "pass" | "fail";
  findings: LintFinding[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

const _writeMigrationLint = createArtifactWriter<MigrationLintData>({
  id: STUDIO_ARTIFACTS.MIGRATION_LINT.id,
  version: STUDIO_ARTIFACTS.MIGRATION_LINT.version,
  producer: "@sbtools/plugin-migration-studio",
});

export function writeMigrationLintArtifact(ctx: PluginContext, data: MigrationLintData): void {
  _writeMigrationLint(ctx, data, { generatedAt: data.lintedAt });
}

// ---------------------------------------------------------------------------
// studio.release.gate
// ---------------------------------------------------------------------------

const _writeReleaseGate = createArtifactWriter<ReleaseGate>({
  id: STUDIO_ARTIFACTS.RELEASE_GATE.id,
  version: STUDIO_ARTIFACTS.RELEASE_GATE.version,
  producer: "@sbtools/plugin-migration-studio",
});

export function writeReleaseGateArtifact(ctx: PluginContext, data: ReleaseGate): void {
  _writeReleaseGate(ctx, data, { generatedAt: data.generatedAt });
}

// ---------------------------------------------------------------------------
// studio.workflow.run
// ---------------------------------------------------------------------------

const _writeWorkflowRun = createArtifactWriter<WorkflowRun>({
  id: STUDIO_ARTIFACTS.WORKFLOW_RUN.id,
  version: STUDIO_ARTIFACTS.WORKFLOW_RUN.version,
  producer: "@sbtools/plugin-migration-studio",
});

export function writeWorkflowRunArtifact(ctx: PluginContext, data: WorkflowRun): void {
  _writeWorkflowRun(ctx, data, { generatedAt: data.updatedAt });
}
