import { ui } from "@sbtools/sdk";
import type { EndpointMapResult } from "../core/studio-endpoint-map.core.js";
import { runEndpointMap } from "../core/studio-endpoint-map.core.js";
import { STUDIO_ARTIFACTS } from "../../artifacts/constants.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";

const HELP = `
studio-endpoint-map — Derive PostgREST/RPC endpoint declarations from the intent graph

Usage:
  sbt studio-endpoint-map
`;

export const tool: StudioToolDefinition<void, EndpointMapResult> = {
  id: "studio-endpoint-map",
  async run(ctx) {
    return runEndpointMap(ctx);
  },
  cli: {
    command: "studio-endpoint-map",
    description: "Derive endpoint declarations from intent graph",
    help: HELP,
    parseArgs: () => undefined,
    onSuccess: (result) => {
      ui.success(`Endpoint map: ${result.total} endpoint(s) derived`);
      ui.detail(`  table-crud: ${result.entityEndpoints}  rpc: ${result.rpcEndpoints}`);
      ui.detail(`Written to .sbt/artifacts/${STUDIO_ARTIFACTS.INTENT_GRAPH.id}/1.0.0/latest.json`);
    },
  },
  http: {
    method: "POST",
    path: "/api/studio/endpoint-map",
    parseRequest: async () => undefined,
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "Derive API Endpoints",
  whatItDoes: "Builds endpoint declarations from the intent graph for tables and RPC functions.",
  whenToUse: "Use after intent graph updates to refresh expected API surface.",
  whatItNeeds: ["studio.intent.graph artifact"],
  whatItProduces: ["Updated endpoints inside studio.intent.graph"],
  audience: "mixed",
  controlModes: ["managed","assisted"],
};





