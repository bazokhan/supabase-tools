/**
 * studio-intent-init: Build IntentGraph from the sync report.
 *
 * Confidence thresholds → managedStatus:
 *   >= 0.80  → 'managed'
 *   >= 0.50  → 'assisted'
 *   < 0.50   → 'opaque'
 *
 * Unmatched DB entities (no SQL source, confidence 0.35) → OpaqueBlock.
 * SQL-only entities (pending apply, confidence 0.70) → 'assisted'.
 *
 * Graph mode:
 *   If >= 80% of entities are 'managed' → 'brownfield-managed'
 *   Otherwise → 'brownfield-assisted'
 */
import type { PluginContext } from "@sbtools/sdk";
import { readArtifactOrNull } from "@sbtools/sdk";
import type {
  IntentGraph,
  EntityNode,
  ManagedStatus,
  ManagedScope,
  OpaqueBlock,
} from "@sbtools/sdk";
import { writeIntentGraphArtifact } from "../../artifacts/writers.js";
import type { IntentSyncData, SchemaSnapshotData, SqlAstData } from "../../artifacts/writers.js";
import { STUDIO_ARTIFACTS } from "../../artifacts/constants.js";

const SYSTEM_SCHEMAS = new Set([
  "auth", "storage", "realtime", "supabase_functions",
  "extensions", "pg_catalog", "information_schema",
]);

function confidenceToStatus(confidence: number): ManagedStatus {
  if (confidence >= 0.8) return "managed";
  if (confidence >= 0.5) return "assisted";
  return "opaque";
}

export async function runIntentInit(ctx: PluginContext): Promise<void> {
  // --- Read prerequisite artifacts ---
  const syncEnv = readArtifactOrNull<IntentSyncData>(
    ctx,
    STUDIO_ARTIFACTS.INTENT_SYNC.id,
    STUDIO_ARTIFACTS.INTENT_SYNC.version
  );
  if (!syncEnv) {
    throw Object.assign(
      new Error("studio.intent.sync-report artifact not found. Run studio-intent-sync first."),
      { code: "MISSING_ARTIFACT", artifact: STUDIO_ARTIFACTS.INTENT_SYNC.id }
    );
  }

  const snapshotEnv = readArtifactOrNull<SchemaSnapshotData>(
    ctx,
    STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id,
    STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.version
  );
  if (!snapshotEnv) {
    throw Object.assign(
      new Error("studio.schema.snapshot artifact not found. Run studio-introspect first."),
      { code: "MISSING_ARTIFACT", artifact: STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id }
    );
  }

  const astEnv = readArtifactOrNull<SqlAstData>(
    ctx,
    STUDIO_ARTIFACTS.SQL_AST.id,
    STUDIO_ARTIFACTS.SQL_AST.version
  );

  const syncData = syncEnv.data;
  const snapshot = snapshotEnv.data;

  // --- Build entity lookup maps ---
  const dbEntityById = new Map(snapshot.entities.map((e) => [e.id, e]));
  const sqlEntityById = new Map(
    (astEnv?.data.allEntities ?? [])
      .filter((e) => e.id)
      .map((e) => [e.id!, e])
  );

  const entities: EntityNode[] = [];
  const opaqueBlocks: OpaqueBlock[] = [];
  const userSchemas = new Set<string>();

  // --- Process matched entities ---
  for (const match of syncData.matched) {
    if (match.objectType !== "entity") continue;
    const dbEntity = dbEntityById.get(match.objectId);
    if (!dbEntity) continue;

    userSchemas.add(dbEntity.schema);
    const status = confidenceToStatus(match.confidence);

    if (status === "opaque") {
      opaqueBlocks.push({
        id: `entity:${match.objectId}`,
        rawSql: "",
        sourceSpan: { file: "", startLine: 0, endLine: 0 },
        touchedObjects: [match.objectId],
        reason: "too-complex",
        astAvailable: false,
      });
    } else {
      entities.push({
        ...dbEntity,
        managedStatus: status,
        confidence: match.confidence,
        columns: dbEntity.columns.map((c) => ({
          ...c,
          managedStatus: status,
          confidence: match.confidence,
        })),
      });
    }
  }

  // --- Process DB-only entities (unknown SQL provenance) ---
  for (const unmatched of syncData.unmatchedDb) {
    if (unmatched.objectType !== "entity") continue;
    const dbEntity = dbEntityById.get(unmatched.objectId);
    if (!dbEntity) continue;

    userSchemas.add(dbEntity.schema);
    opaqueBlocks.push({
      id: `entity:${unmatched.objectId}`,
      rawSql: "",
      sourceSpan: { file: "", startLine: 0, endLine: 0 },
      touchedObjects: [unmatched.objectId],
      reason: "too-complex",
      astAvailable: false,
    });
  }

  // --- Process SQL-only entities (pending or not yet applied) ---
  for (const unmatched of syncData.unmatchedIntent) {
    if (unmatched.objectType !== "entity") continue;
    const sqlEntity = sqlEntityById.get(unmatched.objectId);
    if (!sqlEntity || !sqlEntity.id) continue;

    const schema = sqlEntity.schema ?? unmatched.objectId.split(".")[0] ?? "public";
    userSchemas.add(schema);
    entities.push({
      id: sqlEntity.id,
      schema,
      name: sqlEntity.name ?? unmatched.objectId.split(".")[1] ?? unmatched.objectId,
      managedStatus: "assisted",
      confidence: 0.7,
      columns: (sqlEntity.columns as EntityNode["columns"]) ?? [],
      constraints: (sqlEntity.constraints as EntityNode["constraints"]) ?? [],
      indexes: (sqlEntity.indexes as EntityNode["indexes"]) ?? [],
    });
  }

  // --- Determine graph mode ---
  const totalEntities = entities.length + opaqueBlocks.filter((b) => b.id.startsWith("entity:")).length;
  const managedCount = entities.filter((e) => e.managedStatus === "managed").length;
  const managedRatio = totalEntities > 0 ? managedCount / totalEntities : 0;
  const mode: IntentGraph["mode"] = managedRatio >= 0.8 ? "brownfield-managed" : "brownfield-assisted";

  // --- Build managedScope ---
  const schemas: ManagedScope["schemas"] = {};
  for (const schema of userSchemas) {
    schemas[schema] = "managed";
  }
  for (const sysSchema of SYSTEM_SCHEMAS) {
    schemas[sysSchema] = "excluded";
  }

  const graph: IntentGraph = {
    version: "1.0.0",
    mode,
    entities,
    views: snapshot.views.map((v) => ({
      ...v,
      managedStatus: "assisted" as ManagedStatus,
      confidence: 0.7,
    })),
    functions: snapshot.functions.map((f) => ({
      ...f,
      managedStatus: "assisted" as ManagedStatus,
      confidence: 0.7,
    })),
    triggers: snapshot.triggers.map((t) => ({
      ...t,
      managedStatus: "assisted" as ManagedStatus,
      confidence: 0.7,
    })),
    policies: snapshot.policies.map((p) => ({
      ...p,
      managedStatus: "assisted" as ManagedStatus,
      confidence: 0.7,
    })),
    endpoints: [],
    infrastructure: snapshot.infrastructure,
    opaqueBlocks,
    managedScope: { schemas, explicitExclusions: [] },
  };

  writeIntentGraphArtifact(ctx, graph);
}

