import { ui } from "@sbtools/sdk";
import type { CreateViewInput } from "../core/studio-create-view.core.js";
import { runCreateView } from "../core/studio-create-view.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";
import { optionalArg, readJsonBody, requiredArg } from "./module-utils.js";

const HELP = `
studio-create-view — Generate CREATE OR REPLACE VIEW migration

Usage:
  sbt studio-create-view --schema public --name <view_name> --query "SELECT ..."

Options:
  --schema   Schema (default: public)
  --name     View name (required)
  --query    SELECT query body (required)
`;

function parseCliInput(args: string[]): CreateViewInput {
  return {
    schema: optionalArg(args, "--schema") ?? "public",
    name: requiredArg(args, "--name"),
    query: requiredArg(args, "--query"),
  };
}

export const tool: StudioToolDefinition<CreateViewInput, { sql: string; filename: string }> = {
  id: "studio-create-view",
  async run(ctx, input) {
    return runCreateView(ctx, input);
  },
  cli: {
    command: "studio-create-view",
    description: "Generate CREATE OR REPLACE VIEW migration",
    help: HELP,
    parseArgs: (args) => parseCliInput(args),
    onSuccess: (result) => ui.success(`Written ${result.filename}`),
  },
  http: {
    method: "POST",
    path: "/api/studio/scaffold/create-view",
    parseRequest: async (req) => {
      const input = await readJsonBody(req) as Partial<CreateViewInput>;
      if (!input.name || !input.query) throw new Error("name and query are required");
      return {
        schema: input.schema ?? "public",
        name: String(input.name),
        query: String(input.query),
      };
    },
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "Create View",
  whatItDoes: "Generates a migration that creates or replaces a SQL view.",
  whenToUse: "Use when you want a reusable read model built from one or more tables.",
  whatItNeeds: ["View name", "SELECT query"],
  whatItProduces: ["New SQL migration file with CREATE OR REPLACE VIEW"],
  audience: "backend-dev",
  controlModes: ["assisted","loose"],
};





