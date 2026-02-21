/**
 * generate-create-view tool
 *
 * Generates a CREATE OR REPLACE VIEW migration from a schema, name, and SELECT query.
 * Does not require an existing intent graph — views can be created independently.
 */
import fs from "node:fs";
import path from "node:path";
import type { PluginContext } from "@sbtools/sdk";

export interface CreateViewInput {
  schema: string;
  name: string;
  /** The SELECT query body (everything after AS). */
  query: string;
}

export interface CreateViewResult {
  sql: string;
  filename: string;
}

export async function runCreateView(ctx: PluginContext, input: CreateViewInput): Promise<CreateViewResult> {
  const { schema, name, query } = input;
  if (!schema?.trim() || !name?.trim() || !query?.trim()) {
    const err = new Error("schema, name, and query are required");
    throw Object.assign(err, { code: "INVALID_INPUT" });
  }

  const sql = `CREATE OR REPLACE VIEW ${schema}.${name} AS\n${query.trim()};`;

  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");
  const filename = `${Date.now()}_create_view_${slug}.sql`;
  const migrationsDir = ctx.paths.migrations;
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  fs.writeFileSync(path.join(migrationsDir, filename), sql + "\n", "utf8");
  return { sql, filename };
}

