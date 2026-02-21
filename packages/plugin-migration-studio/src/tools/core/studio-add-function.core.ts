/**
 * Generate CREATE OR REPLACE FUNCTION migration.
 */
import fs from "node:fs";
import path from "node:path";
import type { PluginContext } from "@sbtools/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddFunctionInput {
  schema: string;
  name: string;
  params: Array<{ name: string; type: string }>;
  returnType: string;
  language: "sql" | "plpgsql";
  body: string;
  security?: "invoker" | "definer"; // default: invoker
}

// ---------------------------------------------------------------------------
// SQL generation
// ---------------------------------------------------------------------------

function escapeIdentifier(id: string): string {
  if (/^[a-z_][a-z0-9_]*$/i.test(id)) return id;
  return `"${id.replace(/"/g, '""')}"`;
}

function buildAddFunctionSql(input: AddFunctionInput): string {
  const schemaId = escapeIdentifier(input.schema);
  const nameId = escapeIdentifier(input.name);
  const paramList = input.params
    .map((p) => `${escapeIdentifier(p.name)} ${escapeIdentifier(p.type)}`)
    .join(", ");
  const returnClause = input.returnType.toUpperCase().startsWith("TABLE")
    ? input.returnType
    : escapeIdentifier(input.returnType);
  const lang = input.language.toLowerCase() === "plpgsql" ? "plpgsql" : "sql";
  const security = input.security === "definer" ? "SECURITY DEFINER" : "SECURITY INVOKER";

  return `CREATE OR REPLACE FUNCTION ${schemaId}.${nameId}(${paramList})
RETURNS ${returnClause}
LANGUAGE ${lang}
${security}
AS $$
${input.body}
$$;`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface RunAddFunctionOpts {
  /** Override filename prefix (default: "add_function"). Use "create_rpc" for RPC. */
  filenamePrefix?: string;
}

export async function runAddFunction(
  ctx: PluginContext,
  input: AddFunctionInput,
  opts?: RunAddFunctionOpts
): Promise<{ sql: string; filename: string }> {
  const sql = buildAddFunctionSql(input);

  const migrationsDir = ctx.paths?.migrations ?? path.join(ctx.projectRoot, "supabase", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  const slug = input.name.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  const timestamp = Date.now();
  const prefix = opts?.filenamePrefix ?? "add_function";
  const filename = `${timestamp}_${prefix}_${slug}.sql`;
  const filePath = path.join(migrationsDir, filename);
  fs.writeFileSync(filePath, sql + "\n", "utf8");

  return { sql, filename };
}

