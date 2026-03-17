/**
 * RLS coverage checker.
 *
 * For every managed entity in the intent graph, verifies that at least one
 * policy exists for each of SELECT / INSERT / UPDATE / DELETE. Entities with
 * no policy coverage are flagged as gaps. SECURITY DEFINER functions without
 * an explicit search_path are emitted as warnings.
 *
 * Policies are considered from: (1) intent graph / DB snapshot, (2) SQL AST
 * (parsed migration files). This ensures pending migrations that add policies
 * are counted, so the gate does not block apply when those migrations will
 * fix the gaps.
 *
 * Produces: studio.rls.plan  (suggested placeholder policies)
 *           studio.rls.report (coverage analysis + gaps)
 */
import type { PluginContext } from "@sbtools/sdk";
import { readArtifactOrNull } from "@sbtools/sdk";
import type { IntentGraph, PolicyNode } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../artifacts/constants.js";
import {
  writeRlsPlanArtifact,
  writeRlsReportArtifact,
} from "../../artifacts/writers.js";
import type {
  RlsPlanData,
  RlsPolicyEntry,
  RlsReportData,
  RlsGap,
} from "../../artifacts/writers.js";
import type { SqlAstData } from "../../artifacts/writers.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CRUD_COMMANDS = ["SELECT", "INSERT", "UPDATE", "DELETE"] as const;
type CrudCommand = (typeof CRUD_COMMANDS)[number];

/** Common column names that reference the owning user's ID. */
const USER_ID_COLUMN_NAMES = [
  "user_id",
  "owner_id",
  "created_by",
  "author_id",
  "account_id",
  "profile_id",
  "member_id",
];

/**
 * Infer a default USING/WITH CHECK expression from the entity's columns.
 * If a known user-ownership column is present, returns `auth.uid() = <col>`.
 * Otherwise returns `auth.uid() IS NOT NULL` (requires authentication).
 */
function inferAccessExpression(columns: { name: string; type: string }[]): string {
  const ownerCol = columns.find((c) =>
    USER_ID_COLUMN_NAMES.includes(c.name.toLowerCase())
  );
  if (ownerCol) {
    return `auth.uid() = ${ownerCol.name}`;
  }
  return "auth.uid() IS NOT NULL";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function coveredCommands(policies: (PolicyNode | Partial<PolicyNode>)[]): Set<string> {
  const covered = new Set<string>();
  for (const p of policies) {
    const cmd = p.command;
    if (!cmd) continue;
    if (cmd === "ALL") {
      for (const c of CRUD_COMMANDS) covered.add(c);
    } else {
      covered.add(cmd);
    }
  }
  return covered;
}

/** Merge policies from graph (DB) and SQL AST (migration files including pending). */
function policiesForEntity(
  entityId: string,
  graphPolicies: PolicyNode[],
  astPolicies: Partial<PolicyNode>[] | undefined
): (PolicyNode | Partial<PolicyNode>)[] {
  const fromGraph = graphPolicies.filter((p) => p.entity === entityId);
  const fromAst = (astPolicies ?? []).filter((p) => p.entity === entityId);
  const seen = new Set<string>();
  const result: (PolicyNode | Partial<PolicyNode>)[] = [];
  for (const p of [...fromGraph, ...fromAst]) {
    const key = `${p.entity ?? ""}:${p.name ?? ""}:${p.command ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(p);
  }
  return result;
}

function buildSuggestedPolicySql(
  schema: string,
  table: string,
  name: string,
  command: CrudCommand,
  accessExpr: string
): string {
  const lines = [
    `CREATE POLICY "${name}"`,
    `  ON ${schema}.${table}`,
    `  AS PERMISSIVE`,
    `  FOR ${command}`,
    `  TO authenticated`,
  ];

  if (command !== "INSERT") {
    lines.push(`  USING (${accessExpr})`);
  }
  if (command === "INSERT" || command === "UPDATE") {
    lines.push(`  WITH CHECK (${accessExpr})`);
  }

  lines.push(";");
  return lines.join("\n");
}

function suggestedPolicy(
  entityId: string,
  command: CrudCommand,
  schema: string,
  table: string,
  columns: { name: string; type: string }[]
): RlsPolicyEntry {
  const policyName = `${table}_${command.toLowerCase()}_authenticated`;
  const accessExpr = inferAccessExpression(columns);
  const usingSql = command !== "INSERT" ? accessExpr : "";
  const withCheckSql =
    command === "INSERT" || command === "UPDATE" ? accessExpr : undefined;

  return {
    entityId,
    policyName,
    command,
    roles: ["authenticated"],
    usingSql,
    withCheckSql,
    permissive: true,
    template: "inferred",
    generatedSql: buildSuggestedPolicySql(schema, table, policyName, command, accessExpr),
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runRlsCheck(ctx: PluginContext): Promise<{
  plan: RlsPlanData;
  report: RlsReportData;
}> {
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

  const astEnv = readArtifactOrNull<SqlAstData>(
    ctx,
    STUDIO_ARTIFACTS.SQL_AST.id,
    STUDIO_ARTIFACTS.SQL_AST.version
  );
  const astPolicies = astEnv?.data?.allPolicies;

  const graph = graphEnv.data;
  const checkedAt = new Date().toISOString();

  const gaps: RlsGap[] = [];
  const warnings: RlsReportData["warnings"] = [];
  const planPolicies: RlsPolicyEntry[] = [];
  const entitiesWithoutPolicies: string[] = [];

  const managedEntities = graph.entities.filter(
    (e) => e.managedStatus !== "opaque" && e.managedStatus !== "excluded"
  );

  for (const entity of managedEntities) {
    const parts = entity.id.split(".");
    const schema = parts.length >= 2 ? parts[0] : "public";
    const table = parts.length >= 2 ? (parts[1] ?? entity.name) : entity.name;

    const entityPolicies = policiesForEntity(
      entity.id,
      graph.policies,
      astPolicies
    );
    const covered = coveredCommands(entityPolicies);
    const missing = CRUD_COMMANDS.filter(
      (cmd) => !covered.has(cmd)
    ) as CrudCommand[];

    if (entityPolicies.length === 0) {
      entitiesWithoutPolicies.push(entity.id);
    }

    if (missing.length > 0) {
      gaps.push({
        entityId: entity.id,
        missingCommands: missing,
        reason:
          entityPolicies.length === 0
            ? "No policies defined for this entity"
            : `Missing coverage for: ${missing.join(", ")}`,
      });
      for (const cmd of missing) {
        planPolicies.push(suggestedPolicy(entity.id, cmd, schema, table, entity.columns));
      }
    }
  }

  // SECURITY DEFINER without explicit search_path
  for (const fn of graph.functions) {
    if (
      fn.security === "definer" &&
      (!fn.searchPath || fn.searchPath.length === 0)
    ) {
      warnings.push({
        entityId: fn.id,
        message: `SECURITY DEFINER function "${fn.id}" has no explicit SET search_path — vulnerable to search_path injection`,
        code: "DEFINER_NO_SEARCH_PATH",
      });
    }
  }

  const plan: RlsPlanData = {
    generatedAt: checkedAt,
    policies: planPolicies,
    entitiesWithoutPolicies,
  };

  const report: RlsReportData = {
    checkedAt,
    status: gaps.length === 0 ? "pass" : "fail",
    gaps,
    warnings,
    entitiesChecked: managedEntities.length,
    tablesWithRls: managedEntities.length - entitiesWithoutPolicies.length,
    tablesWithoutRls: entitiesWithoutPolicies.length,
  };

  writeRlsPlanArtifact(ctx, plan);
  writeRlsReportArtifact(ctx, report);

  return { plan, report };
}

