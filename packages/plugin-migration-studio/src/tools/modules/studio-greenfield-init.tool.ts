import { ui } from "@sbtools/sdk";
import type { IntentGraph } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../artifacts/constants.js";
import { runGreenfieldInit } from "../core/studio-greenfield-init.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";

const HELP = `
studio-greenfield-init — Create an empty intent graph for greenfield (no-DB) projects

Usage:
  sbt studio-greenfield-init
`;

export const tool: StudioToolDefinition<void, IntentGraph> = {
  id: "studio-greenfield-init",
  async run(ctx) {
    return runGreenfieldInit(ctx);
  },
  cli: {
    command: "studio-greenfield-init",
    description: "Create empty intent graph for greenfield projects",
    help: HELP,
    parseArgs: () => undefined,
    onSuccess: (graph) => {
      ui.success(`Greenfield intent graph created (mode: ${graph.mode}, 0 entities)`);
      ui.detail(`Written to .sbt/artifacts/${STUDIO_ARTIFACTS.INTENT_GRAPH.id}/1.0.0/latest.json`);
    },
  },
  http: {
    method: "POST",
    path: "/api/studio/greenfield-init",
    parseRequest: async () => undefined,
    toResponse: (graph) => ({ mode: graph.mode, entities: graph.entities.length }),
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "Initialize Greenfield Intent Graph",
  whatItDoes: "Creates an empty project intent graph so you can design schema before any live database exists.",
  whenToUse: "Use at project start when building database structure from scratch.",
  whatItNeeds: ["No existing artifacts required"],
  whatItProduces: ["studio.intent.graph artifact in greenfield mode"],
  audience: "mixed",
  controlModes: ["assisted","loose"],
};





