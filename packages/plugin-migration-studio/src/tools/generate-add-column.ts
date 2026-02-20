/**
 * Generate ADD COLUMN migration for an intent-graph entity.
 * Validates entity exists and is not opaque before generating.
 */
import fs from "node:fs";
import path from "node:path";
import type { PluginContext } from "@sbtools/sdk";
import { readArtifactOrNull } from "@sbtools/sdk";
import type { IntentGraph } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../artifacts/constants.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddColumnInput {
  entityId: string; // "public.users"
  column: {
    name: string;
    type: string;
    nullable: boolean;
    default?: string;
  };
}

// ---------------------------------------------------------------------------
// SQL generation
// ---------------------------------------------------------------------------

function escapeIdentifier(id: string): string {
  if (/^[a-z_][a-z0-9_]*$/i.test(id)) return id;
  return `"${id.replace(/"/g, '""')}"`;
}

function buildAddColumnSql(input: AddColumnInput): string {
  const { entityId, column } = input;
  const parts = entityId.split(".");
  const schema = parts.length >= 2 ? parts[0] : "public";
  const table = parts.length >= 2 ? parts[1] : parts[0] ?? entityId;

  const schemaId = escapeIdentifier(schema);
  const tableId = escapeIdentifier(table);
  const colId = escapeIdentifier(column.name);
  const typeId = escapeIdentifier(column.type);

  let sql = `ALTER TABLE ${schemaId}.${tableId} ADD COLUMN ${colId} ${typeId}`;
  if (!column.nullable) sql += " NOT NULL";
  if (column.default != null && column.default !== "") sql += ` DEFAULT ${column.default}`;
  sql += ";";
  return sql;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runAddColumn(
  ctx: PluginContext,
  input: AddColumnInput
): Promise<{ sql: string; filename: string }> {
  const graphEnv = readArtifactOrNull<IntentGraph>(
    ctx,
    STUDIO_ARTIFACTS.INTENT_GRAPH.id,
    STUDIO_ARTIFACTS.INTENT_GRAPH.version
  );

  if (!graphEnv?.data) {
    throw Object.assign(new Error("studio.intent.graph artifact not found. Run studio-adopt first."), {
      code: "MISSING_ARTIFACT",
    });
  }

  const entity = graphEnv.data.entities.find((e) => e.id === input.entityId);
  if (!entity) {
    throw Object.assign(new Error(`Entity not found: ${input.entityId}`), {
      code: "ENTITY_NOT_FOUND",
      entityId: input.entityId,
    });
  }

  if (entity.managedStatus === "opaque") {
    throw Object.assign(new Error(`Entity ${input.entityId} is opaque and cannot be scaffolded.`), {
      code: "ENTITY_OPAQUE",
      entityId: input.entityId,
    });
  }

  const sql = buildAddColumnSql(input);

  const migrationsDir = ctx.paths?.migrations ?? path.join(ctx.projectRoot, "supabase", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  const slug = `${entity.name}_${input.column.name}`.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  const timestamp = Date.now();
  const filename = `${timestamp}_add_column_${slug}.sql`;
  const filePath = path.join(migrationsDir, filename);
  fs.writeFileSync(filePath, sql + "\n", "utf8");

  return { sql, filename };
}
