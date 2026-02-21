import { ui } from "@sbtools/sdk";
import type { IntentPatchInput, IntentPatchResult } from "../core/studio-intent-patch.core.js";
import { runIntentPatch } from "../core/studio-intent-patch.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";
import { optionalArg, readJsonBody, requiredArg } from "./module-utils.js";

const HELP = `
studio-intent-patch — Patch a single entity's classification in the intent graph

Usage:
  sbt studio-intent-patch --entity <schema.table> --action <exclude|set-status> [--status <managed|assisted|opaque>]
`;

function parseCliInput(args: string[]): IntentPatchInput {
  const entity = requiredArg(args, "--entity");
  const action = requiredArg(args, "--action") as "exclude" | "set-status";
  const status = optionalArg(args, "--status") as "managed" | "assisted" | "opaque" | undefined;
  if (action !== "exclude" && action !== "set-status") {
    throw new Error("--action must be exclude or set-status");
  }
  return { entityId: entity, action, status };
}

export const tool: StudioToolDefinition<IntentPatchInput, IntentPatchResult> = {
  id: "studio-intent-patch",
  async run(ctx, input) {
    return runIntentPatch(ctx, input);
  },
  cli: {
    command: "studio-intent-patch",
    description: "Patch entity classification in intent graph",
    help: HELP,
    parseArgs: (args) => parseCliInput(args),
    onSuccess: (result) => {
      ui.success(`Patched ${result.entityId}: ${result.previousStatus} → ${result.newStatus}`);
      ui.detail(`Excluded count: ${result.excludedCount} / ${result.totalEntities} total entities`);
    },
  },
  http: {
    method: "POST",
    path: "/api/studio/intent-graph/entity",
    parseRequest: async (req) => {
      const input = await readJsonBody(req) as Partial<IntentPatchInput>;
      if (!input.entityId || !input.action) throw new Error("entityId and action are required");
      return {
        entityId: String(input.entityId),
        action: input.action as "exclude" | "set-status",
        status: input.status as "managed" | "assisted" | "opaque" | undefined,
      };
    },
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "Reclassify Entity",
  whatItDoes: "Updates one entity's managed status in the intent graph.",
  whenToUse: "Use when adoption confidence needs manual override or an entity should be excluded.",
  whatItNeeds: ["Entity id", "Patch action"],
  whatItProduces: ["Updated studio.intent.graph artifact"],
  audience: "mixed",
  controlModes: ["managed","assisted"],
};





