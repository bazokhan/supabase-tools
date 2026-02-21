/**
 * endpoint-map tool
 *
 * Derives PostgREST/RPC endpoint declarations from the intent graph and writes
 * them back into the same artifact. Produces:
 *
 *  - "table-crud" endpoints for each managed entity (exposed via PostgREST)
 *  - "rpc" endpoints for each managed function in schema: public
 *
 * No DB connection required. Pure structural inference from the intent graph.
 */
import { writeArtifact, readArtifactOrNull } from "@sbtools/sdk";
import type { EndpointNode, IntentGraph, PluginContext } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../artifacts/constants.js";

export interface EndpointMapResult {
  entityEndpoints: number;
  rpcEndpoints: number;
  total: number;
}

export async function runEndpointMap(ctx: PluginContext): Promise<EndpointMapResult> {
  const env = readArtifactOrNull<IntentGraph>(
    ctx,
    STUDIO_ARTIFACTS.INTENT_GRAPH.id,
    STUDIO_ARTIFACTS.INTENT_GRAPH.version
  );

  if (!env?.data) {
    const err = new Error("studio.intent.graph artifact not found — run studio-adopt or studio-greenfield-init first");
    throw Object.assign(err, { code: "MISSING_ARTIFACT" });
  }

  const graph = structuredClone(env.data) as IntentGraph;
  const endpoints: EndpointNode[] = [];

  // Table CRUD endpoints — one per managed entity exposed via PostgREST
  for (const entity of graph.entities) {
    if (entity.managedStatus !== "managed") continue;

    // Collect allowed roles from the entity's policies
    const entityPolicies = graph.policies.filter((p) => p.entity === entity.id);
    const allowedRoles = [...new Set(entityPolicies.flatMap((p) => p.roles))];

    endpoints.push({
      id: `endpoint:table-crud:${entity.id}`,
      type: "table-crud",
      entity: entity.id,
      exposedVia: "postgrest",
      allowedRoles,
      operations: ["read", "create", "update", "delete"],
    });
  }

  // RPC endpoints — one per managed public-schema function
  for (const fn of graph.functions) {
    if (fn.schema !== "public") continue;
    if (fn.managedStatus !== "managed") continue;

    endpoints.push({
      id: `endpoint:rpc:${fn.id}`,
      type: "rpc",
      entity: fn.id,
      exposedVia: "rpc",
      allowedRoles: [],
      operations: ["create"],
    });
  }

  graph.endpoints = endpoints;

  writeArtifact(ctx, {
    id: STUDIO_ARTIFACTS.INTENT_GRAPH.id,
    version: STUDIO_ARTIFACTS.INTENT_GRAPH.version,
    producer: "endpoint-map",
    generatedAt: new Date().toISOString(),
    data: graph,
  });

  const entityEndpoints = endpoints.filter((e) => e.type === "table-crud").length;
  const rpcEndpoints = endpoints.filter((e) => e.type === "rpc").length;

  return {
    entityEndpoints,
    rpcEndpoints,
    total: endpoints.length,
  };
}

