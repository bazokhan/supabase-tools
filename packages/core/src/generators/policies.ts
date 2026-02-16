import type { PolicyRow } from "@sbtools/sdk";
import { snapshotFileHeader } from "@sbtools/sdk";

/**
 * Builds a single CREATE POLICY block from a policy row.
 *
 * @param p - Policy row from pg_policies.
 * @param schema - Schema name (for ON clause).
 * @param table - Table name (for ON clause).
 * @returns One policy block string.
 */
function formatPolicyBlock(p: PolicyRow, schema: string, table: string): string {
  let roles = "PUBLIC";
  if (p.roles) {
    if (Array.isArray(p.roles) && p.roles.length > 0) {
      roles = p.roles.map((x: string) => `"${x}"`).join(", ");
    } else if (typeof p.roles === "string" && p.roles.trim()) {
      roles = `"${p.roles}"`;
    }
  }
  const asPermissive = p.permissive ? "PERMISSIVE" : "RESTRICTIVE";
  const cmd = (p.cmd || "ALL").toUpperCase();
  const using = p.qual ? `USING (${p.qual})` : "";
  const withCheck = p.with_check ? `WITH CHECK (${p.with_check})` : "";

  return `-- Policy: ${p.policy_name}
CREATE POLICY "${p.policy_name}"
ON ${schema}.${table}
AS ${asPermissive}
FOR ${cmd}
TO ${roles}
${using}
${withCheck}
;`;
}

/**
 * Builds the full file content for RLS policies for one table.
 *
 * @param schema - Schema name.
 * @param table - Table name.
 * @param policies - Policy rows from pg_policies for that table.
 * @returns Content string to write.
 */
export function formatPoliciesFile(
  schema: string,
  table: string,
  policies: PolicyRow[]
): string {
  const blocks = policies.map((p) => formatPolicyBlock(p, schema, table));
  return (
    snapshotFileHeader({
      objectType: `RLS policies for ${schema}.${table}`,
      headers: { Note: "this is reconstructed from pg_policies" },
    }) + blocks.join("\n\n") + "\n"
  );
}
