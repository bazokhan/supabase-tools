/**
 * greenfield-init tool
 *
 * Creates an empty intent graph with mode: 'greenfield'.
 * No DB connection required — safe to run on fresh projects with no existing schema.
 * The resulting graph can be populated by scaffold tools (generate-create-table, etc.).
 */
import { writeArtifact } from "@sbtools/sdk";
import type { IntentGraph, PluginContext } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../artifacts/constants.js";

export async function runGreenfieldInit(ctx: PluginContext): Promise<IntentGraph> {
  const graph: IntentGraph = {
    version: "1.0.0",
    mode: "greenfield",
    entities: [],
    views: [],
    functions: [],
    triggers: [],
    policies: [],
    endpoints: [],
    infrastructure: [],
    opaqueBlocks: [],
    managedScope: {
      schemas: { public: "managed" },
      explicitExclusions: [],
    },
  };

  writeArtifact(ctx, {
    id: STUDIO_ARTIFACTS.INTENT_GRAPH.id,
    version: STUDIO_ARTIFACTS.INTENT_GRAPH.version,
    producer: "greenfield-init",
    generatedAt: new Date().toISOString(),
    data: graph,
  });

  return graph;
}

