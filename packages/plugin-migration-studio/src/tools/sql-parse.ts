/**
 * studio-sql-parse: Walk the migrations directory, parse each .sql file with
 * @supabase/pg-parser, extract structured intent nodes, write studio.sql.ast.
 *
 * Reuses the already-tested parseMigrationSql + extractSchemaNodes from sql-parser.ts.
 * Also applies the regex sql-analyzer for risk metadata (Layer 1).
 */
import fs from "node:fs";
import path from "node:path";
import type { PluginContext } from "@sbtools/sdk";
import type {
  EntityNode,
  PolicyNode,
  FunctionNode,
  ViewNode,
  TriggerNode,
  InfraNode,
} from "@sbtools/sdk";
import { parseMigrationSql, extractSchemaNodes } from "../sql-parser.js";
import { writeSqlAstArtifact } from "../artifacts/writers.js";
import type { SqlAstFileEntry } from "../artifacts/writers.js";

// ---------------------------------------------------------------------------
// Deduplication helper
// ---------------------------------------------------------------------------

function mergeById<T extends { id?: string }>(arrays: T[][]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const arr of arrays) {
    for (const item of arr) {
      const key = item.id ?? JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runSqlParse(ctx: PluginContext): Promise<void> {
  const migrationsDir =
    ctx.paths?.migrations ??
    path.join(ctx.projectRoot, "supabase", "migrations");

  // Collect .sql files sorted alphabetically (migration order)
  let sqlFiles: string[] = [];
  if (fs.existsSync(migrationsDir)) {
    sqlFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  }

  const parsedAt = new Date().toISOString();
  const fileEntries: SqlAstFileEntry[] = [];

  for (const filename of sqlFiles) {
    const filePath = path.join(migrationsDir, filename);
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch {
      continue; // skip unreadable files
    }

    const parsed = await parseMigrationSql(content, filename);
    const extracted = extractSchemaNodes(parsed.statements);

    fileEntries.push({
      filename,
      nodeTypes: [...new Set(parsed.statements.map((s) => s.nodeType))],
      statementCount: parsed.statements.length,
      opaqueBlockCount: parsed.opaqueBlocks.length,
      touchedObjects: parsed.riskMeta.touchedObjectKeys,
      riskMeta: parsed.riskMeta,
      opaqueBlocks: parsed.opaqueBlocks,
      entities: extracted.entities as Partial<EntityNode>[],
      policies: extracted.policies as Partial<PolicyNode>[],
      functions: extracted.functions as Partial<FunctionNode>[],
      views: extracted.views as Partial<ViewNode>[],
      triggers: extracted.triggers as Partial<TriggerNode>[],
      infrastructure: extracted.infrastructure as Partial<InfraNode>[],
    });
  }

  const allEntities = mergeById(fileEntries.map((f) => f.entities));
  const allPolicies = mergeById(fileEntries.map((f) => f.policies));
  const allFunctions = mergeById(fileEntries.map((f) => f.functions));
  const allViews = mergeById(fileEntries.map((f) => f.views));
  const allTriggers = mergeById(fileEntries.map((f) => f.triggers));
  const allInfrastructure = mergeById(fileEntries.map((f) => f.infrastructure));

  writeSqlAstArtifact(ctx, {
    migrationsDir,
    parsedAt,
    files: fileEntries,
    totalStatements: fileEntries.reduce((s, f) => s + f.statementCount, 0),
    totalOpaqueBlocks: fileEntries.reduce((s, f) => s + f.opaqueBlockCount, 0),
    allEntities,
    allPolicies,
    allFunctions,
    allViews,
    allTriggers,
    allInfrastructure,
  });
}
