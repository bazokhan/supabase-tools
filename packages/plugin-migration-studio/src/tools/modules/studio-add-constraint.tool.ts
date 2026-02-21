import { ui } from "@sbtools/sdk";
import type { AddConstraintInput } from "../core/studio-add-constraint.core.js";
import { runAddConstraint } from "../core/studio-add-constraint.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";
import { optionalArg, readJsonBody, requiredArg } from "./module-utils.js";

const HELP = `
studio-add-constraint — Generate ALTER TABLE ADD CONSTRAINT migration

Usage:
  sbt studio-add-constraint --entity <schema.table> --name <constraint_name> --type <fk|unique|check> [options]

Foreign key options:
  --type fk --columns <col> --ref-table <schema.table> --ref-columns <col> [--on-delete CASCADE] [--on-update SET NULL]

Unique options:
  --type unique --columns <col1,col2>

Check options:
  --type check --check "price > 0"
`;

function parseCliInput(args: string[]): AddConstraintInput {
  const typeArg = requiredArg(args, "--type");
  const type = typeArg === "fk" ? "foreign_key" : typeArg as AddConstraintInput["constraint"]["type"];
  const columnsStr = optionalArg(args, "--columns");
  const refTableStr = optionalArg(args, "--ref-table");
  const refColumnsStr = optionalArg(args, "--ref-columns");
  const onDelete = optionalArg(args, "--on-delete") as AddConstraintInput["constraint"]["references"] extends infer R
    ? R extends { onDelete?: infer D } ? D : never
    : never;
  const onUpdate = optionalArg(args, "--on-update") as AddConstraintInput["constraint"]["references"] extends infer R
    ? R extends { onUpdate?: infer U } ? U : never
    : never;
  const columns = columnsStr ? columnsStr.split(",").map((c) => c.trim()).filter(Boolean) : undefined;

  let references: AddConstraintInput["constraint"]["references"] | undefined;
  if (type === "foreign_key" && refTableStr) {
    const refParts = refTableStr.split(".");
    const refSchema = refParts.length >= 2 ? refParts[0] : "public";
    const refTable = refParts.length >= 2 ? (refParts[1] ?? refParts[0]) : refParts[0] ?? refTableStr;
    const refCols = refColumnsStr ? refColumnsStr.split(",").map((c) => c.trim()).filter(Boolean) : ["id"];
    references = { schema: refSchema, table: refTable, columns: refCols, onDelete, onUpdate };
  }

  return {
    entityId: requiredArg(args, "--entity"),
    constraint: {
      name: requiredArg(args, "--name"),
      type,
      columns,
      references,
      check: optionalArg(args, "--check"),
    },
  };
}

export const tool: StudioToolDefinition<AddConstraintInput, { sql: string; filename: string }> = {
  id: "studio-add-constraint",
  async run(ctx, input) {
    return runAddConstraint(ctx, input);
  },
  cli: {
    command: "studio-add-constraint",
    description: "Generate ALTER TABLE ADD CONSTRAINT migration",
    help: HELP,
    parseArgs: (args) => parseCliInput(args),
    onSuccess: (result) => ui.success(`Written ${result.filename}`),
  },
  http: {
    method: "POST",
    path: "/api/studio/scaffold/add-constraint",
    parseRequest: async (req) => {
      const input = await readJsonBody(req) as Partial<AddConstraintInput>;
      if (!input.entityId || !input.constraint?.name || !input.constraint?.type) {
        throw new Error("entityId and constraint { name, type } are required");
      }
      return {
        entityId: String(input.entityId),
        constraint: input.constraint,
      };
    },
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "Add Constraint",
  whatItDoes: "Creates a migration that adds foreign key, unique, or check constraints to a table.",
  whenToUse: "Use when enforcing stronger data integrity rules in existing tables.",
  whatItNeeds: ["Target table id", "Constraint type", "Constraint details"],
  whatItProduces: ["New SQL migration file with ALTER TABLE ... ADD CONSTRAINT"],
  audience: "backend-dev",
  controlModes: ["assisted","loose"],
};





