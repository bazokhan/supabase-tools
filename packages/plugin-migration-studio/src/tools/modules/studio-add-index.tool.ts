import { ui } from "@sbtools/sdk";
import type { AddIndexInput } from "../core/studio-add-index.core.js";
import { runAddIndex } from "../core/studio-add-index.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";
import { flag, optionalArg, readJsonBody, requiredArg } from "./module-utils.js";

const HELP = `
studio-add-index — Generate CREATE INDEX migration

Usage:
  sbt studio-add-index --entity <schema.table> --columns <col1,col2> [--unique] [--method btree] [--name <idx_name>] [--where "expr"]

Options:
  --entity     Entity ID (e.g. public.users)
  --columns    Comma-separated column names
  --unique     Create UNIQUE INDEX
  --method     btree | hash | gin | gist | brin (default: btree)
  --name       Index name (auto-generated if omitted)
  --where      Partial index predicate
`;

function parseCliInput(args: string[]): AddIndexInput {
  return {
    entityId: requiredArg(args, "--entity"),
    index: {
      name: optionalArg(args, "--name"),
      columns: requiredArg(args, "--columns").split(",").map((c) => c.trim()).filter(Boolean),
      unique: flag(args, "--unique"),
      method: (optionalArg(args, "--method") ?? "btree") as AddIndexInput["index"]["method"],
      where: optionalArg(args, "--where"),
    },
  };
}

export const tool: StudioToolDefinition<AddIndexInput, { sql: string; filename: string }> = {
  id: "studio-add-index",
  async run(ctx, input) {
    return runAddIndex(ctx, input);
  },
  cli: {
    command: "studio-add-index",
    description: "Generate CREATE INDEX migration",
    help: HELP,
    parseArgs: (args) => parseCliInput(args),
    onSuccess: (result) => ui.success(`Written ${result.filename}`),
  },
  http: {
    method: "POST",
    path: "/api/studio/scaffold/add-index",
    parseRequest: async (req) => {
      const input = await readJsonBody(req) as Partial<AddIndexInput>;
      if (!input.entityId || !Array.isArray(input.index?.columns)) {
        throw new Error("entityId and index.columns[] are required");
      }
      return {
        entityId: String(input.entityId),
        index: {
          name: input.index.name != null ? String(input.index.name) : undefined,
          columns: input.index.columns.map(String),
          unique: Boolean(input.index.unique),
          method: input.index.method ?? "btree",
          where: input.index.where != null ? String(input.index.where) : undefined,
        },
      };
    },
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "Add Index",
  whatItDoes: "Creates a migration that adds an index to speed up query performance.",
  whenToUse: "Use when queries on one or more columns become slow.",
  whatItNeeds: ["Target table id", "Indexed columns"],
  whatItProduces: ["New SQL migration file with CREATE INDEX"],
  audience: "backend-dev",
  controlModes: ["assisted","loose"],
};





