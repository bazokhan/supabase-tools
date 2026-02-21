/**
 * Migration plan: diff intent graph vs live DB snapshot.
 *
 * Compares the intent graph (design truth) against the DB snapshot (runtime
 * truth) and produces an ordered list of changes classified by risk:
 *
 *   additive_safe          — new entity / new nullable column / new policy
 *   additive_with_default  — new NOT NULL column with a DEFAULT
 *   type_change_narrowing  — new NOT NULL column with no default (requires careful migration)
 *   drop                   — column/entity removed from intent graph (commented, not auto-applied)
 *   policy_change          — policy added or removed
 *   constraint_change      — constraint added or removed
 *
 * Produces: studio.migration.plan
 */
import crypto from "node:crypto";
import type { PluginContext } from "@sbtools/sdk";
import { readArtifactOrNull } from "@sbtools/sdk";
import type { IntentGraph, EntityNode, ColumnNode, PolicyNode } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../artifacts/constants.js";
import { writeMigrationPlanArtifact } from "../../artifacts/writers.js";
import type {
  MigrationChange,
  MigrationPlanData,
  ChangeClass,
} from "../../artifacts/writers.js";
import type { SchemaSnapshotData } from "../../artifacts/writers.js";

// ---------------------------------------------------------------------------
// Hash helper
// ---------------------------------------------------------------------------

function hashSnapshot(snapshot: SchemaSnapshotData): string {
  const payload = JSON.stringify({
    entities: snapshot.entities.map((e) => ({ id: e.id, columns: e.columns.map((c) => c.name) })),
    policies: snapshot.policies.map((p) => p.id),
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// SQL generation for changes
// ---------------------------------------------------------------------------

function escapeIdentifier(id: string): string {
  if (/^[a-z_][a-z0-9_]*$/i.test(id)) return id;
  return `"${id.replace(/"/g, '""')}"`;
}

function buildCreateTableSql(entity: EntityNode): string {
  const schemaId = escapeIdentifier(entity.schema);
  const tableId = escapeIdentifier(entity.name);
  const cols = entity.columns.map((c) => {
    let def = `  ${escapeIdentifier(c.name)} ${c.type}`;
    if (!c.nullable) def += " NOT NULL";
    if (c.default) def += ` DEFAULT ${c.default}`;
    return def;
  });
  const pk = entity.constraints.find((cn) => cn.type === "primary_key");
  if (pk && pk.columns.length > 0) {
    cols.push(`  PRIMARY KEY (${pk.columns.map(escapeIdentifier).join(", ")})`);
  }
  return `CREATE TABLE ${schemaId}.${tableId} (\n${cols.join(",\n")}\n);\nALTER TABLE ${schemaId}.${tableId} ENABLE ROW LEVEL SECURITY;`;
}

function buildAddColumnSql(entityId: string, col: ColumnNode): string {
  const parts = entityId.split(".");
  const schema = parts.length >= 2 ? parts[0] : "public";
  const table = parts.length >= 2 ? (parts[1] ?? parts[0]) : parts[0] ?? entityId;
  let sql = `ALTER TABLE ${escapeIdentifier(schema)}.${escapeIdentifier(table)} ADD COLUMN ${escapeIdentifier(col.name)} ${col.type}`;
  if (!col.nullable) sql += " NOT NULL";
  if (col.default) sql += ` DEFAULT ${col.default}`;
  sql += ";";
  return sql;
}

function buildDropColumnComment(entityId: string, colName: string): string {
  const parts = entityId.split(".");
  const schema = parts.length >= 2 ? parts[0] : "public";
  const table = parts.length >= 2 ? (parts[1] ?? parts[0]) : parts[0] ?? entityId;
  return `-- DESTRUCTIVE (review before applying):\n-- ALTER TABLE ${escapeIdentifier(schema)}.${escapeIdentifier(table)} DROP COLUMN ${escapeIdentifier(colName)};`;
}

function buildAddPolicySql(policy: PolicyNode): string {
  const parts = policy.entity.split(".");
  const schema = parts.length >= 2 ? parts[0] : "public";
  const table = parts.length >= 2 ? (parts[1] ?? parts[0]) : parts[0] ?? policy.entity;
  const lines = [
    `CREATE POLICY ${escapeIdentifier(policy.name)}`,
    `  ON ${escapeIdentifier(schema)}.${escapeIdentifier(table)}`,
    `  AS ${policy.permissive ? "PERMISSIVE" : "RESTRICTIVE"}`,
    `  FOR ${policy.command}`,
    `  TO ${policy.roles.map(escapeIdentifier).join(", ")}`,
  ];
  if (policy.using) lines.push(`  USING (${policy.using})`);
  if (policy.withCheck) lines.push(`  WITH CHECK (${policy.withCheck})`);
  lines.push(";");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Diffing logic
// ---------------------------------------------------------------------------

function diffEntities(
  intentEntity: EntityNode,
  snapshotEntity: EntityNode
): MigrationChange[] {
  const changes: MigrationChange[] = [];

  const snapshotColNames = new Set(snapshotEntity.columns.map((c) => c.name));
  const intentColNames = new Set(intentEntity.columns.map((c) => c.name));

  // Columns in intent but not in snapshot → additions
  for (const col of intentEntity.columns) {
    if (snapshotColNames.has(col.name)) continue;

    let changeClass: ChangeClass;
    if (col.nullable) {
      changeClass = "additive_safe";
    } else if (col.default != null && col.default !== "") {
      changeClass = "additive_with_default";
    } else {
      changeClass = "type_change_narrowing"; // NOT NULL without default — requires care
    }

    changes.push({
      objectId: `${intentEntity.id}.${col.name}`,
      changeClass,
      description: `Add column ${col.name} (${col.type}${col.nullable ? "" : " NOT NULL"}${col.default ? ` DEFAULT ${col.default}` : ""}) to ${intentEntity.id}`,
      sql: [buildAddColumnSql(intentEntity.id, col)],
      requiresConfirmation: changeClass === "type_change_narrowing",
    });
  }

  // Columns in snapshot but not in intent → drops (commented out — destructive)
  for (const col of snapshotEntity.columns) {
    if (intentColNames.has(col.name)) continue;

    changes.push({
      objectId: `${intentEntity.id}.${col.name}`,
      changeClass: "drop",
      description: `Drop column ${col.name} from ${intentEntity.id} (removed from intent graph)`,
      sql: [buildDropColumnComment(intentEntity.id, col.name)],
      requiresConfirmation: true,
    });
  }

  // New constraints (in intent not in snapshot)
  const snapshotConstraintNames = new Set(snapshotEntity.constraints.map((c) => c.name));
  for (const constraint of intentEntity.constraints) {
    if (snapshotConstraintNames.has(constraint.name)) continue;
    changes.push({
      objectId: `${intentEntity.id}.${constraint.name}`,
      changeClass: "constraint_change",
      description: `Add constraint ${constraint.name} to ${intentEntity.id}`,
      sql: [`ALTER TABLE ${escapeIdentifier(intentEntity.schema)}.${escapeIdentifier(intentEntity.name)} ADD CONSTRAINT ${escapeIdentifier(constraint.name)} ${constraint.definition};`],
      requiresConfirmation: false,
    });
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runMigrationPlan(ctx: PluginContext): Promise<MigrationPlanData> {
  const graphEnv = readArtifactOrNull<IntentGraph>(
    ctx,
    STUDIO_ARTIFACTS.INTENT_GRAPH.id,
    STUDIO_ARTIFACTS.INTENT_GRAPH.version
  );
  if (!graphEnv?.data) {
    throw Object.assign(
      new Error("studio.intent.graph artifact not found. Run studio-adopt first."),
      { code: "MISSING_ARTIFACT" }
    );
  }

  const snapshotEnv = readArtifactOrNull<SchemaSnapshotData>(
    ctx,
    STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id,
    STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.version
  );
  if (!snapshotEnv?.data) {
    throw Object.assign(
      new Error("studio.schema.snapshot artifact not found. Run studio-introspect first."),
      { code: "MISSING_ARTIFACT" }
    );
  }

  const graph = graphEnv.data;
  const snapshot = snapshotEnv.data;
  const generatedAt = new Date().toISOString();
  const snapshotHash = hashSnapshot(snapshot);

  const changes: MigrationChange[] = [];

  const snapshotEntityMap = new Map(snapshot.entities.map((e) => [e.id, e]));
  const snapshotPolicyIds = new Set(snapshot.policies.map((p) => p.id));

  // Managed entities only
  const managedEntities = graph.entities.filter(
    (e) => e.managedStatus !== "opaque" && e.managedStatus !== "excluded"
  );

  for (const intentEntity of managedEntities) {
    const snapshotEntity = snapshotEntityMap.get(intentEntity.id);

    if (!snapshotEntity) {
      // Entirely new entity — CREATE TABLE
      changes.push({
        objectId: intentEntity.id,
        changeClass: "additive_safe",
        description: `Create new table ${intentEntity.id}`,
        sql: [buildCreateTableSql(intentEntity)],
        requiresConfirmation: false,
      });
    } else {
      // Existing entity — diff columns and constraints
      changes.push(...diffEntities(intentEntity, snapshotEntity));
    }
  }

  // New policies in intent not in snapshot
  for (const policy of graph.policies) {
    if (policy.managedStatus === "opaque" || policy.managedStatus === "excluded") continue;
    if (!snapshotPolicyIds.has(policy.id)) {
      changes.push({
        objectId: policy.id,
        changeClass: "policy_change",
        description: `Add policy ${policy.name} on ${policy.entity}`,
        sql: [buildAddPolicySql(policy)],
        requiresConfirmation: false,
      });
    }
  }

  // Sort: additive_safe first, then policy_change, then constraint_change, drops last
  const ORDER: Record<ChangeClass, number> = {
    additive_safe: 0,
    additive_with_default: 1,
    policy_change: 2,
    constraint_change: 3,
    rename_expand_contract: 4,
    type_change_widening: 5,
    type_change_narrowing: 6,
    drop: 7,
  };
  changes.sort((a, b) => (ORDER[a.changeClass] ?? 99) - (ORDER[b.changeClass] ?? 99));

  const destructiveCount = changes.filter((c) => c.changeClass === "drop").length;
  const expandContractCount = changes.filter(
    (c) => c.changeClass === "rename_expand_contract"
  ).length;

  const result: MigrationPlanData = {
    generatedAt,
    snapshotHash,
    changes,
    totalChanges: changes.length,
    destructiveCount,
    expandContractCount,
  };

  writeMigrationPlanArtifact(ctx, result);

  return result;
}

