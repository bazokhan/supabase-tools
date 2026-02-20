/**
 * Zod schemas for Migration Studio artifact data fields.
 *
 * Used for runtime validation at tool boundaries (reading / writing artifacts).
 * These schemas are NOT imported by the SDK — they live in plugin-migration-studio only.
 *
 * Each schema corresponds to an entry in STUDIO_ARTIFACTS and its data interface in writers.ts.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

const managedStatusSchema = z.enum(["managed", "assisted", "opaque", "excluded"]);

const sourceOriginSchema = z.object({
  migration: z.string(),
  line: z.number().int().nonnegative(),
  astNodeType: z.string().optional(),
});

const opaqueBlockSchema = z.object({
  id: z.string(),
  rawSql: z.string(),
  sourceSpan: z.object({
    file: z.string(),
    startLine: z.number().int(),
    endLine: z.number().int(),
  }),
  touchedObjects: z.array(z.string()),
  reason: z.enum(["unrepresentable", "user-excluded", "too-complex"]),
  astAvailable: z.boolean(),
});

const artifactRefSchema = z.object({
  id: z.string(),
  version: z.string(),
});

// ---------------------------------------------------------------------------
// Intent graph node schemas
// ---------------------------------------------------------------------------

const columnNodeSchema = z.object({
  name: z.string(),
  type: z.string(),
  nullable: z.boolean(),
  default: z.string().optional(),
  identity: z.enum(["always", "by-default"]).optional(),
  generated: z.string().optional(),
  managedStatus: managedStatusSchema,
  confidence: z.number().min(0).max(1),
});

const constraintNodeSchema = z.object({
  name: z.string(),
  type: z.enum(["primary_key", "unique", "check", "foreign_key", "exclusion"]),
  columns: z.array(z.string()),
  definition: z.string(),
  references: z
    .object({
      schema: z.string(),
      table: z.string(),
      columns: z.array(z.string()),
      onDelete: z.string().optional(),
      onUpdate: z.string().optional(),
    })
    .optional(),
});

const indexNodeSchema = z.object({
  name: z.string(),
  columns: z.array(z.string()),
  unique: z.boolean(),
  method: z.enum(["btree", "hash", "gin", "gist", "brin"]),
  where: z.string().optional(),
  definition: z.string(),
});

const entityNodeSchema = z.object({
  id: z.string(),
  schema: z.string(),
  name: z.string(),
  managedStatus: managedStatusSchema,
  confidence: z.number().min(0).max(1),
  columns: z.array(columnNodeSchema),
  constraints: z.array(constraintNodeSchema),
  indexes: z.array(indexNodeSchema),
  origin: sourceOriginSchema.optional(),
  customSqlBlocks: z.array(z.string()).optional(),
});

const viewNodeSchema = z.object({
  id: z.string(),
  schema: z.string(),
  name: z.string(),
  materialized: z.boolean(),
  query: z.string(),
  columns: z.array(z.object({ name: z.string(), type: z.string() })),
  managedStatus: managedStatusSchema,
  confidence: z.number().min(0).max(1),
});

const triggerNodeSchema = z.object({
  id: z.string(),
  entity: z.string(),
  name: z.string(),
  timing: z.enum(["BEFORE", "AFTER", "INSTEAD OF"]),
  events: z.array(z.enum(["INSERT", "UPDATE", "DELETE", "TRUNCATE"])),
  forEach: z.enum(["ROW", "STATEMENT"]),
  function: z.string(),
  condition: z.string().optional(),
  managedStatus: managedStatusSchema,
  confidence: z.number().min(0).max(1),
});

const policyNodeSchema = z.object({
  id: z.string(),
  entity: z.string(),
  name: z.string(),
  command: z.enum(["SELECT", "INSERT", "UPDATE", "DELETE", "ALL"]),
  roles: z.array(z.string()),
  using: z.string().optional(),
  withCheck: z.string().optional(),
  permissive: z.boolean(),
  template: z.string().optional(),
  templateParams: z.record(z.string()).optional(),
  managedStatus: managedStatusSchema,
  confidence: z.number().min(0).max(1),
});

const argSpecSchema = z.object({
  name: z.string().optional(),
  type: z.string(),
  mode: z.enum(["in", "out", "inout", "variadic"]),
  default: z.string().optional(),
});

const functionNodeSchema = z.object({
  id: z.string(),
  schema: z.string(),
  name: z.string(),
  args: z.array(argSpecSchema),
  returnType: z.string(),
  language: z.enum(["sql", "plpgsql", "plv8"]),
  security: z.enum(["invoker", "definer"]),
  volatility: z.enum(["volatile", "stable", "immutable"]),
  searchPath: z.array(z.string()).optional(),
  body: z.string().optional(),
  managedStatus: managedStatusSchema,
  confidence: z.number().min(0).max(1),
});

const endpointNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["table-crud", "rpc", "view"]),
  entity: z.string(),
  exposedVia: z.enum(["postgrest", "rpc"]),
  allowedRoles: z.array(z.string()),
  operations: z.array(z.enum(["read", "create", "update", "delete"])),
});

const infraNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["extension", "schema", "role"]),
  name: z.string(),
  details: z.record(z.string()),
  managedStatus: managedStatusSchema,
});

const managedScopeSchema = z.object({
  schemas: z.record(z.enum(["managed", "read-only", "excluded"])),
  explicitExclusions: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// studio.intent.graph
// ---------------------------------------------------------------------------

export const intentGraphSchema = z.object({
  version: z.literal("1.0.0"),
  mode: z.enum(["greenfield", "brownfield-managed", "brownfield-assisted"]),
  entities: z.array(entityNodeSchema),
  views: z.array(viewNodeSchema),
  functions: z.array(functionNodeSchema),
  triggers: z.array(triggerNodeSchema),
  policies: z.array(policyNodeSchema),
  endpoints: z.array(endpointNodeSchema),
  infrastructure: z.array(infraNodeSchema),
  opaqueBlocks: z.array(opaqueBlockSchema),
  managedScope: managedScopeSchema,
});

export type IntentGraphData = z.infer<typeof intentGraphSchema>;

// ---------------------------------------------------------------------------
// studio.schema.snapshot
// ---------------------------------------------------------------------------

export const schemaSnapshotSchema = z.object({
  capturedAt: z.string(),
  pgVersion: z.string().optional(),
  connectionUrl: z.string().optional(),
  entities: z.array(entityNodeSchema),
  views: z.array(viewNodeSchema),
  functions: z.array(functionNodeSchema),
  policies: z.array(policyNodeSchema),
  triggers: z.array(triggerNodeSchema),
  infrastructure: z.array(infraNodeSchema),
});

// ---------------------------------------------------------------------------
// studio.sql.ast
// ---------------------------------------------------------------------------

const sqlAstFileEntrySchema = z.object({
  filename: z.string(),
  nodeTypes: z.array(z.string()),
  statementCount: z.number().int().nonnegative(),
  opaqueBlockCount: z.number().int().nonnegative(),
  touchedObjects: z.array(z.string()),
  riskMeta: z.object({
    operations: z.array(z.unknown()),
    touchedObjectKeys: z.array(z.string()),
    riskFlags: z.object({
      hasTransaction: z.boolean(),
      hasDestructive: z.boolean(),
      hasIfExists: z.boolean(),
      hasIfNotExists: z.boolean(),
      hasTruncate: z.boolean(),
      hasDrop: z.boolean(),
    }),
    confidence: z.enum(["high", "medium", "low"]),
  }),
  opaqueBlocks: z.array(opaqueBlockSchema),
  entities: z.array(entityNodeSchema.partial()),
  policies: z.array(policyNodeSchema.partial()),
  functions: z.array(functionNodeSchema.partial()),
  views: z.array(viewNodeSchema.partial()),
  triggers: z.array(triggerNodeSchema.partial()),
  infrastructure: z.array(infraNodeSchema.partial()),
});

export const sqlAstSchema = z.object({
  migrationsDir: z.string(),
  parsedAt: z.string(),
  files: z.array(sqlAstFileEntrySchema),
  totalStatements: z.number().int().nonnegative(),
  totalOpaqueBlocks: z.number().int().nonnegative(),
  allEntities: z.array(entityNodeSchema.partial()),
  allPolicies: z.array(policyNodeSchema.partial()),
  allFunctions: z.array(functionNodeSchema.partial()),
  allViews: z.array(viewNodeSchema.partial()),
  allTriggers: z.array(triggerNodeSchema.partial()),
  allInfrastructure: z.array(infraNodeSchema.partial()),
});

// ---------------------------------------------------------------------------
// studio.release.gate
// ---------------------------------------------------------------------------

const gateReasonSchema = z.object({
  code: z.string(),
  severity: z.enum(["error", "warning"]),
  message: z.string(),
  artifact: artifactRefSchema,
  remediation: z.string().optional(),
});

const acknowledgementSchema = z.object({
  id: z.string(),
  message: z.string(),
  acknowledgedAt: z.string().optional(),
  acknowledgedBy: z.string().optional(),
});

export const releaseGateSchema = z.object({
  status: z.enum(["pass", "fail"]),
  blocking: z.array(gateReasonSchema),
  warnings: z.array(gateReasonSchema),
  acknowledgements: z.array(acknowledgementSchema),
  evidence: z.array(artifactRefSchema),
  snapshotHash: z.string(),
  generatedAt: z.string(),
});

// ---------------------------------------------------------------------------
// studio.workflow.run
// ---------------------------------------------------------------------------

const stepResultSchema = z.object({
  stepId: z.string(),
  status: z.enum(["completed", "failed", "skipped"]),
  artifact: artifactRefSchema.optional(),
  error: z.string().optional(),
  startedAt: z.string(),
  completedAt: z.string(),
});

export const workflowRunSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  status: z.enum(["running", "waiting_checkpoint", "failed", "completed"]),
  currentStep: z.number().int().nonnegative(),
  steps: z.array(stepResultSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
