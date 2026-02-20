/**
 * Generate CREATE POLICY migration.
 *
 * Does NOT require an existing intent graph — works for any table.
 */
import fs from "node:fs";
import path from "node:path";
import type { PluginContext } from "@sbtools/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RlsCommand = "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "ALL";

export interface AddRlsPolicyInput {
  /** Entity ID in "schema.table" format, e.g. "public.users" */
  entityId: string;
  policy: {
    name: string;
    command: RlsCommand;
    /** Roles to grant the policy to. Use ["public"] for unauthenticated access. */
    roles: string[];
    /** USING expression (required for SELECT, UPDATE, DELETE). */
    using?: string;
    /** WITH CHECK expression (for INSERT, UPDATE). */
    withCheck?: string;
    /** Default: true (PERMISSIVE). Set false for RESTRICTIVE. */
    permissive?: boolean;
  };
}

// ---------------------------------------------------------------------------
// SQL generation
// ---------------------------------------------------------------------------

function escapeIdentifier(id: string): string {
  if (/^[a-z_][a-z0-9_]*$/i.test(id)) return id;
  return `"${id.replace(/"/g, '""')}"`;
}

export function buildAddRlsPolicySql(input: AddRlsPolicyInput): string {
  const parts = input.entityId.split(".");
  const schema = parts.length >= 2 ? parts[0] : "public";
  const table = parts.length >= 2 ? parts[1] : (parts[0] ?? input.entityId);

  const { policy } = input;
  const permissive = policy.permissive !== false;
  const roleList = policy.roles.map(escapeIdentifier).join(", ");

  const lines: string[] = [
    `CREATE POLICY ${escapeIdentifier(policy.name)}`,
    `  ON ${escapeIdentifier(schema)}.${escapeIdentifier(table)}`,
    `  AS ${permissive ? "PERMISSIVE" : "RESTRICTIVE"}`,
    `  FOR ${policy.command}`,
    `  TO ${roleList}`,
  ];

  if (policy.using) {
    lines.push(`  USING (${policy.using})`);
  }
  if (policy.withCheck) {
    lines.push(`  WITH CHECK (${policy.withCheck})`);
  }

  return lines.join("\n") + ";";
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runAddRlsPolicy(
  ctx: PluginContext,
  input: AddRlsPolicyInput
): Promise<{ sql: string; filename: string }> {
  const sql = buildAddRlsPolicySql(input);

  const migrationsDir = ctx.paths?.migrations ?? path.join(ctx.projectRoot, "supabase", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  const slug = `${input.entityId}_${input.policy.name}`
    .replace(/[^a-z0-9_]/gi, "_")
    .toLowerCase();
  const timestamp = Date.now();
  const filename = `${timestamp}_add_rls_policy_${slug}.sql`;
  const filePath = path.join(migrationsDir, filename);
  fs.writeFileSync(filePath, sql + "\n", "utf8");

  return { sql, filename };
}
