import { runIntentInit } from "../core/studio-intent-init.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";

export const tool: StudioToolDefinition<void, void> = {
  id: "studio-intent-init",
  workflowEnabled: true,
  async run(ctx) {
    await runIntentInit(ctx);
  },
  http: {
    method: "POST",
    path: "/api/studio/intent-init",
    parseRequest: async () => undefined,
    toResponse: async () => ({ ok: true }),
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "Intent Graph Initialization",
  whatItDoes: "Builds the intent graph using confidence output from intent sync.",
  whenToUse: "Runs as the final stage of adoption to produce the working graph.",
  whatItNeeds: ["studio.intent.sync-report artifact"],
  whatItProduces: ["studio.intent.graph artifact"],
  audience: "backend-dev",
  controlModes: ["managed"],
};





