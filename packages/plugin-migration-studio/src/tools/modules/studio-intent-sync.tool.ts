import { runIntentSync } from "../core/studio-intent-sync.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";

export const tool: StudioToolDefinition<void, void> = {
  id: "studio-intent-sync",
  workflowEnabled: true,
  async run(ctx) {
    await runIntentSync(ctx);
  },
  http: {
    method: "POST",
    path: "/api/studio/intent-sync",
    parseRequest: async () => undefined,
    toResponse: async () => ({ ok: true }),
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "Intent Sync",
  whatItDoes: "Compares live schema snapshot with parsed SQL intent and calculates confidence scores.",
  whenToUse: "Runs during adoption workflow between parse and intent graph initialization.",
  whatItNeeds: ["studio.schema.snapshot artifact", "studio.sql.ast artifact"],
  whatItProduces: ["studio.intent.sync-report artifact"],
  audience: "backend-dev",
  controlModes: ["managed"],
};





