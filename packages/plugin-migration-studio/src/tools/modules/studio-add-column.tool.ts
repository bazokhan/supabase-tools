import { ui } from "@sbtools/sdk";
import { runAddColumn, type AddColumnInput } from "../core/studio-add-column.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";
import { flag, optionalArg, readJsonBody, requiredArg } from "./module-utils.js";

const HELP = `
studio-add-column — Add column to intent-graph entity

Usage:
  sbt studio-add-column --entity <schema.table> --name <col> --type <type> [--nullable] [--default "''"]

Options:
  --entity   Entity ID (e.g. public.users)
  --name     Column name
  --type     PostgreSQL type
  --nullable Allow NULL (default: NOT NULL)
  --default  Default expression
`;

function parseCliInput(args: string[]): AddColumnInput {
  return {
    entityId: requiredArg(args, "--entity"),
    column: {
      name: requiredArg(args, "--name"),
      type: requiredArg(args, "--type"),
      nullable: flag(args, "--nullable"),
      default: optionalArg(args, "--default"),
    },
  };
}

export const tool: StudioToolDefinition<AddColumnInput, { sql: string; filename: string }> = {
  id: "studio-add-column",
  async run(ctx, input) {
    return runAddColumn(ctx, input);
  },
  cli: {
    command: "studio-add-column",
    description: "Add column to intent-graph entity",
    help: HELP,
    parseArgs: (args) => parseCliInput(args),
    onSuccess: (result) => ui.success(`Written ${result.filename}`),
  },
  http: {
    method: "POST",
    path: "/api/studio/scaffold/add-column",
    parseRequest: async (req) => {
      const body = await readJsonBody(req) as { entityId?: string; column?: { name?: string; type?: string; nullable?: boolean; default?: string } };
      if (!body.entityId || !body.column?.name || !body.column?.type) {
        throw new Error("entityId and column { name, type } required");
      }
      return {
        entityId: String(body.entityId),
        column: {
          name: String(body.column.name),
          type: String(body.column.type),
          nullable: body.column.nullable !== false,
          default: body.column.default != null ? String(body.column.default) : undefined,
        },
      };
    },
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "Add Table Column",
  whatItDoes: "Creates a migration file that adds a new column to an existing table.",
  whenToUse: "Use when your table needs a new field without recreating the table.",
  whatItNeeds: ["Target table id (schema.table)", "Column name and column type"],
  whatItProduces: ["New SQL migration file in supabase/migrations"],
  audience: "backend-dev",
  controlModes: ["assisted","loose"],
};




