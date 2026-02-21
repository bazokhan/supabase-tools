/**
 * studio-intent-sync: Compare DB snapshot + SQL AST → produce confidence-scored sync report.
 *
 * Confidence scoring rules (per EntityNode):
 *   - ID match (schema.name in both DB and SQL): base 0.85
 *   - Column count exact match:                  +0.05
 *   - All column names match:                    +0.05
 *   - All column types match:                    +0.03
 *   - Policy count matches:                      +0.02
 *   - Each missing column in SQL:                -0.10 (floor 0.0)
 *   - Each type mismatch per column:             -0.05 (floor 0.0)
 *   - DB-only (not in any migration SQL):        0.35 fixed
 *   - SQL-only (in migrations but not in DB):    0.70 fixed
 */
import type { PluginContext } from "@sbtools/sdk";
import { readArtifactOrNull } from "@sbtools/sdk";
import type { EntityNode } from "@sbtools/sdk";
import { writeIntentSyncArtifact } from "../../artifacts/writers.js";
import type { SchemaSnapshotData, SqlAstData } from "../../artifacts/writers.js";
import { STUDIO_ARTIFACTS } from "../../artifacts/constants.js";

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

interface ScoredMatch {
  objectId: string;
  objectType: string;
  confidence: number;
  driftDetails?: string;
}

function scoreEntityMatch(db: EntityNode, sql: Partial<EntityNode>): number {
  let score = 0.85; // base for ID match in both sources

  const dbCols = db.columns ?? [];
  const sqlCols = (sql as EntityNode).columns ?? [];

  if (dbCols.length === sqlCols.length) {
    score += 0.05; // exact column count
  }

  const dbNames = new Set(dbCols.map((c) => c.name));
  const sqlNames = new Set(sqlCols.map((c) => c.name));

  let missingInSql = 0;
  for (const name of dbNames) {
    if (!sqlNames.has(name)) missingInSql++;
  }

  if (missingInSql === 0 && dbNames.size > 0) {
    score += 0.05; // all column names match
  } else {
    score = Math.max(0, score - missingInSql * 0.1);
  }

  // Check type matches for common columns
  let typeMismatches = 0;
  for (const dbCol of dbCols) {
    const sqlCol = sqlCols.find((c) => c.name === dbCol.name);
    if (sqlCol && sqlCol.type && sqlCol.type !== dbCol.type) {
      typeMismatches++;
    }
  }
  if (typeMismatches === 0 && dbCols.length > 0) {
    score += 0.03;
  } else {
    score = Math.max(0, score - typeMismatches * 0.05);
  }

  return Math.min(1.0, score);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runIntentSync(ctx: PluginContext): Promise<void> {
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
  if (!astEnv) {
    throw Object.assign(
      new Error("studio.sql.ast artifact not found. Run studio-sql-parse first."),
      { code: "MISSING_ARTIFACT", artifact: STUDIO_ARTIFACTS.SQL_AST.id }
    );
  }

  const snapshot = snapshotEnv.data;
  const ast = astEnv.data;

  // Build lookup maps
  const dbById = new Map<string, EntityNode>(snapshot.entities.map((e) => [e.id, e]));
  const sqlById = new Map<string, Partial<EntityNode>>(
    ast.allEntities.filter((e) => e.id).map((e) => [e.id!, e])
  );

  const matched: ScoredMatch[] = [];
  const unmatchedDb: Array<{ objectId: string; objectType: string; reason: string }> = [];
  const unmatchedIntent: Array<{ objectId: string; objectType: string }> = [];

  // Entities in DB
  for (const [id, dbEntity] of dbById) {
    const sqlEntity = sqlById.get(id);
    if (sqlEntity) {
      const confidence = scoreEntityMatch(dbEntity, sqlEntity);
      const drift: string[] = [];
      const dbCols = new Set(dbEntity.columns.map((c) => c.name));
      const sqlCols = new Set(
        ((sqlEntity as EntityNode).columns ?? []).map((c) => c.name)
      );
      for (const col of dbCols) {
        if (!sqlCols.has(col)) drift.push(`column '${col}' in DB but not in SQL`);
      }
      matched.push({
        objectId: id,
        objectType: "entity",
        confidence,
        driftDetails: drift.length > 0 ? drift.join("; ") : undefined,
      });
    } else {
      unmatchedDb.push({
        objectId: id,
        objectType: "entity",
        reason: "no_sql_source",
      });
    }
  }

  // SQL-only entities (in migrations but not in DB)
  for (const [id] of sqlById) {
    if (!dbById.has(id)) {
      unmatchedIntent.push({ objectId: id, objectType: "entity" });
    }
  }

  const allConfidences = [
    ...matched.map((m) => m.confidence),
    ...unmatchedDb.map(() => 0.35),
    ...unmatchedIntent.map(() => 0.70),
  ];
  const avgConfidence =
    allConfidences.length > 0
      ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
      : 0;

  const syncedAt = new Date().toISOString();

  writeIntentSyncArtifact(ctx, {
    syncedAt,
    matched,
    unmatchedDb,
    unmatchedIntent,
    summary: {
      matchedCount: matched.length,
      unmatchedDbCount: unmatchedDb.length,
      unmatchedIntentCount: unmatchedIntent.length,
      averageConfidence: Math.round(avgConfidence * 1000) / 1000,
    },
  });
}

