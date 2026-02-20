/**
 * Generate ALTER TABLE ADD CONSTRAINT migration.
 *
 * Supports foreign key, unique, and check constraints.
 * Does NOT require an existing intent graph.
 */
import fs from "node:fs";
import path from "node:path";
import type { PluginContext } from "@sbtools/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConstraintType = "foreign_key" | "unique" | "check";
export type ForeignKeyAction =
  | "CASCADE"
  | "SET NULL"
  | "RESTRICT"
  | "NO ACTION"
  | "SET DEFAULT";

export interface ForeignKeyReferences {
  schema: string;
  table: string;
  columns: string[];
  onDelete?: ForeignKeyAction;
  onUpdate?: ForeignKeyAction;
}

export interface AddConstraintInput {
  /** Entity ID in "schema.table" format, e.g. "public.orders" */
  entityId: string;
  constraint: {
    name: string;
    type: ConstraintType;
    /** Column(s) affected by the constraint (not used for check constraints). */
    columns?: string[];
    /** For foreign_key constraints. */
    references?: ForeignKeyReferences;
    /** For check constraints: the boolean expression. */
    check?: string;
  };
}

// ---------------------------------------------------------------------------
// SQL generation
// ---------------------------------------------------------------------------

function escapeIdentifier(id: string): string {
  if (/^[a-z_][a-z0-9_]*$/i.test(id)) return id;
  return `"${id.replace(/"/g, '""')}"`;
}

function buildForeignKeyClause(refs: ForeignKeyReferences, columns: string[]): string {
  const colList = columns.map(escapeIdentifier).join(", ");
  const refColList = refs.columns.map(escapeIdentifier).join(", ");
  let clause =
    `FOREIGN KEY (${colList})` +
    ` REFERENCES ${escapeIdentifier(refs.schema)}.${escapeIdentifier(refs.table)} (${refColList})`;
  if (refs.onDelete) clause += ` ON DELETE ${refs.onDelete}`;
  if (refs.onUpdate) clause += ` ON UPDATE ${refs.onUpdate}`;
  return clause;
}

export function buildAddConstraintSql(input: AddConstraintInput): string {
  const parts = input.entityId.split(".");
  const schema = parts.length >= 2 ? parts[0] : "public";
  const table = parts.length >= 2 ? parts[1] : (parts[0] ?? input.entityId);

  const { constraint } = input;
  const tableRef = `${escapeIdentifier(schema)}.${escapeIdentifier(table)}`;
  const constraintName = escapeIdentifier(constraint.name);

  let definition: string;

  switch (constraint.type) {
    case "foreign_key": {
      if (!constraint.references) {
        throw new Error("references is required for foreign_key constraints");
      }
      if (!constraint.columns || constraint.columns.length === 0) {
        throw new Error("columns is required for foreign_key constraints");
      }
      definition = buildForeignKeyClause(constraint.references, constraint.columns);
      break;
    }
    case "unique": {
      if (!constraint.columns || constraint.columns.length === 0) {
        throw new Error("columns is required for unique constraints");
      }
      const colList = constraint.columns.map(escapeIdentifier).join(", ");
      definition = `UNIQUE (${colList})`;
      break;
    }
    case "check": {
      if (!constraint.check) {
        throw new Error("check expression is required for check constraints");
      }
      definition = `CHECK (${constraint.check})`;
      break;
    }
    default: {
      throw new Error(`Unsupported constraint type: ${constraint.type}`);
    }
  }

  return `ALTER TABLE ${tableRef}\n  ADD CONSTRAINT ${constraintName}\n  ${definition};`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runAddConstraint(
  ctx: PluginContext,
  input: AddConstraintInput
): Promise<{ sql: string; filename: string }> {
  const sql = buildAddConstraintSql(input);

  const migrationsDir = ctx.paths?.migrations ?? path.join(ctx.projectRoot, "supabase", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  const slug = `${input.entityId}_${input.constraint.name}`
    .replace(/[^a-z0-9_]/gi, "_")
    .toLowerCase();
  const timestamp = Date.now();
  const filename = `${timestamp}_add_constraint_${slug}.sql`;
  const filePath = path.join(migrationsDir, filename);
  fs.writeFileSync(filePath, sql + "\n", "utf8");

  return { sql, filename };
}
