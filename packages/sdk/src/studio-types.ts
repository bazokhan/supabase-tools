/**
 * Intent graph, workflow, and release gate types for Migration Studio Platform.
 *
 * These types are consumed by:
 * - plugin-migration-studio (tools, workflows, artifact writers)
 * - sdk artifact helpers (generic envelope, no runtime deps added here)
 *
 * SDK remains zero-dependency: no Zod here. Zod schemas live in plugin-migration-studio.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Describes how managed an object is within the intent graph. */
export type ManagedStatus = "managed" | "assisted" | "opaque" | "excluded";

/** Provenance link from an intent node back to the migration that defined it. */
export interface SourceOrigin {
  /** Migration filename (e.g., '20240101_init.sql'). */
  migration: string;
  /** Start line in the migration file. */
  line: number;
  /** libpg_query node type that produced this (e.g., 'CreateStmt'). */
  astNodeType?: string;
}

/** Declares the boundary of studio management over schemas and objects. */
export interface ManagedScope {
  /**
   * Per-schema management status.
   * System schemas (auth, storage, realtime, supabase_functions, extensions)
   * are always 'read-only' or 'excluded'.
   */
  schemas: Record<string, "managed" | "read-only" | "excluded">;
  /** Object IDs explicitly excluded by the user. */
  explicitExclusions: string[];
}

// ---------------------------------------------------------------------------
// Entity nodes
// ---------------------------------------------------------------------------

/** A single column definition within an EntityNode. */
export interface ColumnNode {
  name: string;
  /** Resolved Postgres type name (e.g., 'uuid', 'integer', 'text'). */
  type: string;
  nullable: boolean;
  /** Raw SQL default expression. */
  default?: string;
  identity?: "always" | "by-default";
  /** GENERATED ALWAYS AS expression for computed columns. */
  generated?: string;
  managedStatus: ManagedStatus;
  /** Confidence score 0.0–1.0 for this column's extraction fidelity. */
  confidence: number;
}

/** A constraint (PK, UNIQUE, CHECK, FK, EXCLUSION) on an entity. */
export interface ConstraintNode {
  name: string;
  type: "primary_key" | "unique" | "check" | "foreign_key" | "exclusion";
  columns: string[];
  /** Full raw SQL constraint definition. */
  definition: string;
  /** Foreign key details (only present when type === 'foreign_key'). */
  references?: {
    schema: string;
    table: string;
    columns: string[];
    onDelete?: string;
    onUpdate?: string;
  };
}

/** An index on an entity. */
export interface IndexNode {
  name: string;
  columns: string[];
  unique: boolean;
  method: "btree" | "hash" | "gin" | "gist" | "brin";
  /** Partial index predicate (WHERE clause). */
  where?: string;
  /** Full CREATE INDEX SQL expression. */
  definition: string;
}

/** A table entity managed by the intent graph. */
export interface EntityNode {
  /** Stable ID (e.g., 'public.users'). Never includes version. */
  id: string;
  schema: string;
  name: string;
  managedStatus: ManagedStatus;
  /** Confidence score 0.0–1.0 for this entity's extraction fidelity. */
  confidence: number;
  columns: ColumnNode[];
  constraints: ConstraintNode[];
  indexes: IndexNode[];
  /** Migration + line that created this entity. */
  origin?: SourceOrigin;
  /** User-authored SQL blocks to preserve across regeneration. */
  customSqlBlocks?: string[];
}

// ---------------------------------------------------------------------------
// View, trigger, policy, function nodes
// ---------------------------------------------------------------------------

/** A database view (regular or materialized). */
export interface ViewNode {
  /** Stable ID (e.g., 'public.active_users'). */
  id: string;
  schema: string;
  name: string;
  materialized: boolean;
  /** The SELECT statement defining the view. */
  query: string;
  columns: { name: string; type: string }[];
  managedStatus: ManagedStatus;
  confidence: number;
}

/** A database trigger. */
export interface TriggerNode {
  /** Stable ID (e.g., 'trigger:public.users.audit_trigger'). */
  id: string;
  /** Entity ID the trigger fires on. */
  entity: string;
  name: string;
  timing: "BEFORE" | "AFTER" | "INSTEAD OF";
  events: ("INSERT" | "UPDATE" | "DELETE" | "TRUNCATE")[];
  forEach: "ROW" | "STATEMENT";
  /** Function ID that executes when trigger fires. */
  function: string;
  /** WHEN clause condition expression. */
  condition?: string;
  managedStatus: ManagedStatus;
  confidence: number;
}

/** An RLS policy on an entity. */
export interface PolicyNode {
  /** Stable ID (e.g., 'policy:public.users.users_select_authenticated'). */
  id: string;
  /** Entity ID this policy applies to. */
  entity: string;
  name: string;
  command: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "ALL";
  roles: string[];
  /** Raw SQL USING expression or template reference. */
  using?: string;
  withCheck?: string;
  /** true = PERMISSIVE (default), false = RESTRICTIVE. */
  permissive: boolean;
  /** Template name (e.g., 'owner-only', 'role-based', 'org-scoped'). */
  template?: string;
  templateParams?: Record<string, string>;
  managedStatus: ManagedStatus;
  confidence: number;
}

/** Argument spec for a function parameter. */
export interface ArgSpec {
  name?: string;
  type: string;
  mode: "in" | "out" | "inout" | "variadic";
  default?: string;
}

/** A stored function or procedure. */
export interface FunctionNode {
  /** Stable ID including signature (e.g., 'public.get_user_profile(uuid)'). */
  id: string;
  schema: string;
  name: string;
  args: ArgSpec[];
  returnType: string;
  language: "sql" | "plpgsql" | "plv8";
  security: "invoker" | "definer";
  volatility: "volatile" | "stable" | "immutable";
  /** Explicit SET search_path list. Security-critical — absence triggers lint. */
  searchPath?: string[];
  /** Full function body (managed nodes). Absent for opaque functions. */
  body?: string;
  managedStatus: ManagedStatus;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Endpoint and infrastructure nodes
// ---------------------------------------------------------------------------

/** A PostgREST or RPC endpoint declared from an entity/function/view. */
export interface EndpointNode {
  /** Stable ID. */
  id: string;
  type: "table-crud" | "rpc" | "view";
  /** Entity, function, or view ID this endpoint exposes. */
  entity: string;
  exposedVia: "postgrest" | "rpc";
  allowedRoles: string[];
  operations: ("read" | "create" | "update" | "delete")[];
}

/** Infrastructure-level object: extension, schema, or custom role. */
export interface InfraNode {
  /** Stable ID (e.g., 'extension:uuid-ossp', 'schema:public'). */
  id: string;
  type: "extension" | "schema" | "role";
  name: string;
  /** Type-specific metadata. */
  details: Record<string, string>;
  managedStatus: ManagedStatus;
}

// ---------------------------------------------------------------------------
// Opaque block: SQL that was preserved but not modeled
// ---------------------------------------------------------------------------

/**
 * An SQL region that the intent graph cannot represent structurally.
 *
 * `astAvailable: true`  → parser understood it, but the intent graph can't model it yet.
 * `astAvailable: false` → parser failed; SQL is preserved verbatim without AST.
 */
export interface OpaqueBlock {
  id: string;
  rawSql: string;
  sourceSpan: { file: string; startLine: number; endLine: number };
  /** Best-effort list of touched object keys from regex analysis. */
  touchedObjects: string[];
  /**
   * Why this block is opaque.
   * 'unrepresentable' — parser worked but intent graph has no node type for it.
   * 'user-excluded'   — user explicitly excluded this region.
   * 'too-complex'     — semantic complexity (cross-schema deps, dynamic SQL).
   */
  reason: "unrepresentable" | "user-excluded" | "too-complex";
  astAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Intent graph (root data structure)
// ---------------------------------------------------------------------------

/**
 * The central design/control representation of a Supabase backend.
 *
 * Two representations are maintained in sync:
 * - SQL migrations (execution truth)
 * - IntentGraph (design/control truth for studio tools)
 */
export interface IntentGraph {
  version: "1.0.0";
  mode: "greenfield" | "brownfield-managed" | "brownfield-assisted";
  entities: EntityNode[];
  views: ViewNode[];
  functions: FunctionNode[];
  triggers: TriggerNode[];
  policies: PolicyNode[];
  endpoints: EndpointNode[];
  /** Extensions, schemas, and custom roles. */
  infrastructure: InfraNode[];
  /** SQL regions that could not be modeled as intent nodes. */
  opaqueBlocks: OpaqueBlock[];
  managedScope: ManagedScope;
}

// ---------------------------------------------------------------------------
// Artifact reference
// ---------------------------------------------------------------------------

/** A reference to a versioned artifact by ID and version constraint. */
export interface ArtifactRef {
  id: string;
  version: string;
}

// ---------------------------------------------------------------------------
// Workflow types
// ---------------------------------------------------------------------------

/** Gate conditions evaluated against a step's output artifact. */
export interface GatePolicy {
  /** Condition expressions that cause the gate to fail. */
  failIf?: string[];
  /** Condition expressions that produce warnings. */
  warnIf?: string[];
  /** Explicit pass conditions (all must hold). */
  passIf?: string[];
}

/** Runtime context available to workflow step conditions. */
export interface WorkflowContext {
  runId: string;
  steps: StepResult[];
  artifacts: Record<string, ArtifactRef>;
}

/** A single step in a workflow pipeline definition. */
export interface WorkflowStep {
  id: string;
  /** Tool command name this step invokes. */
  tool: string;
  /** Artifact IDs + versions this step requires as input. */
  inputArtifacts: ArtifactRef[];
  /** Artifact ID + version this step produces. */
  outputArtifact: ArtifactRef;
  gate?: GatePolicy;
  /** Human decision required before the next step proceeds. */
  checkpoint?: "review" | "approve";
  /**
   * Optional runtime skip condition.
   * Note: this field is a function — it is not persisted in artifacts.
   */
  skipWhen?: (ctx: WorkflowContext) => boolean;
}

/** Result of a single completed, failed, or skipped workflow step. */
export interface StepResult {
  stepId: string;
  status: "completed" | "failed" | "skipped";
  /** Artifact produced by this step (absent for skipped/failed steps). */
  artifact?: ArtifactRef;
  /** Error message if status === 'failed'. */
  error?: string;
  startedAt: string;
  completedAt: string;
}

/** Lifecycle states for a workflow run. */
export type WorkflowStatus =
  | "running"
  | "waiting_checkpoint"
  | "failed"
  | "completed";

/**
 * A running or completed workflow execution.
 * Persisted as a `studio.workflow.run` artifact for audit trail.
 */
export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  /** Index of the currently executing or last-executed step. */
  currentStep: number;
  steps: StepResult[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Release gate
// ---------------------------------------------------------------------------

/**
 * A single reason within a release gate result.
 * Blocking reasons must be resolved; warnings can be acknowledged.
 */
export interface GateReason {
  /** Stable error/warning code (e.g., 'DESTRUCTIVE_DROP', 'RLS_GAP'). */
  code: string;
  severity: "error" | "warning";
  message: string;
  /** Artifact that produced this finding. */
  artifact: ArtifactRef;
  /** Suggested remediation action. */
  remediation?: string;
}

/** An explicit user acknowledgement of a gate warning. */
export interface Acknowledgement {
  id: string;
  message: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

/**
 * The result of studio-release-check.
 * `status: 'pass'` is required before any migration apply.
 * `snapshotHash` must match the live DB hash at apply time.
 */
export interface ReleaseGate {
  status: "pass" | "fail";
  /** Blocking issues that must be resolved before apply. */
  blocking: GateReason[];
  /** Warnings that should be addressed or explicitly acknowledged. */
  warnings: GateReason[];
  /** User acknowledgements of accepted warnings. */
  acknowledgements: Acknowledgement[];
  /** Artifacts that contributed evidence to this gate result. */
  evidence: ArtifactRef[];
  /** Hash of the schema snapshot at plan time. Must match at apply time. */
  snapshotHash: string;
  generatedAt: string;
}
