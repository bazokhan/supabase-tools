/**
 * RPC / function security linter.
 *
 * Reads FunctionNode entries from the intent graph and checks for common
 * Supabase/PostgreSQL security pitfalls:
 *
 *   DEFINER_NO_SEARCH_PATH  (warning) — SECURITY DEFINER without SET search_path
 *   DEFINER_PUBLIC_EXPOSURE (warning) — SECURITY DEFINER function in schema public
 *                                       with no restricting RLS/policy reference
 *   EMPTY_FUNCTION_BODY     (info)    — function body is empty or not tracked
 *
 * Produces: studio.rpc.plan
 */
import type { PluginContext } from "@sbtools/sdk";
import { readArtifactOrNull } from "@sbtools/sdk";
import type { IntentGraph, FunctionNode } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../artifacts/constants.js";
import { writeRpcPlanArtifact } from "../artifacts/writers.js";
import type { RpcFunctionPlan, RpcPlanData } from "../artifacts/writers.js";

// ---------------------------------------------------------------------------
// Per-function analysis
// ---------------------------------------------------------------------------

function analyzeFunction(fn: FunctionNode): RpcFunctionPlan {
  const lintWarnings: string[] = [];

  const hasSearchPath = Array.isArray(fn.searchPath) && fn.searchPath.length > 0;

  if (fn.security === "definer" && !hasSearchPath) {
    lintWarnings.push(
      "DEFINER_NO_SEARCH_PATH: SECURITY DEFINER without explicit SET search_path — vulnerable to search_path injection. Add: SET search_path = public, pg_temp;"
    );
  }

  if (fn.security === "definer" && fn.schema === "public") {
    lintWarnings.push(
      "DEFINER_PUBLIC_EXPOSURE: SECURITY DEFINER function is exposed in schema public — ensure it validates caller identity before executing privileged operations"
    );
  }

  const hasInputValidation =
    fn.body != null &&
    fn.body.length > 0 &&
    (fn.body.includes("RAISE") ||
      fn.body.includes("IF") ||
      fn.body.includes("assert") ||
      fn.body.includes("perform"));

  if (!fn.body || fn.body.trim() === "") {
    lintWarnings.push("EMPTY_FUNCTION_BODY: function body is missing or not tracked in the intent graph");
  }

  return {
    functionId: fn.id,
    schema: fn.schema,
    name: fn.name,
    security: fn.security,
    hasSearchPath,
    hasInputValidation,
    lintWarnings,
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runRpcLint(ctx: PluginContext): Promise<RpcPlanData> {
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

  const graph = graphEnv.data;
  const generatedAt = new Date().toISOString();

  const managedFunctions = graph.functions.filter(
    (fn) => fn.managedStatus !== "opaque" && fn.managedStatus !== "excluded"
  );

  const functions = managedFunctions.map(analyzeFunction);

  const securityDefinerCount = functions.filter((f) => f.security === "definer").length;
  const missingSearchPathCount = functions.filter(
    (f) => f.security === "definer" && !f.hasSearchPath
  ).length;

  const result: RpcPlanData = {
    generatedAt,
    functions,
    securityDefinerCount,
    missingSearchPathCount,
  };

  writeRpcPlanArtifact(ctx, result);

  return result;
}
