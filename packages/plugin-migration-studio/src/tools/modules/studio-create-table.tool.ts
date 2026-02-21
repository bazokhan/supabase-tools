import { ui } from "@sbtools/sdk";
import type { CreateTableInput } from "../core/studio-create-table.core.js";
import { runCreateTable } from "../core/studio-create-table.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";
import { flag, optionalArg, readJsonBody, requiredArg } from "./module-utils.js";

const HELP = `
studio-create-table — Generate CREATE TABLE migration

Usage:
  sbt studio-create-table --schema public --name <table> --columns "id uuid pk,email text,created_at timestamptz nullable" [--no-rls]

Options:
  --schema     Schema (default: public)
  --name       Table name (required)
  --columns    Column definitions: "name type [pk] [nullable] [default:expr] [identity]" comma-separated
  --no-rls     Skip ENABLE ROW LEVEL SECURITY (default: RLS enabled)
`;

function parseColumns(columnsStr?: string): CreateTableInput["columns"] {
  const columns: CreateTableInput["columns"] = [];
  if (!columnsStr) return columns;
  for (const part of columnsStr.split(",").map((s) => s.trim())) {
    const tokens = part.split(/\s+/);
    const colName = tokens[0];
    const colType = tokens[1];
    if (!colName || !colType) continue;
    const flags = tokens.slice(2);
    const defaultToken = flags.find((f) => f.startsWith("default:"));
    columns.push({
      name: colName,
      type: colType,
      nullable: flags.includes("nullable"),
      default: defaultToken ? defaultToken.slice("default:".length) : undefined,
      identity: flags.includes("identity"),
      primaryKey: flags.includes("pk"),
    });
  }
  return columns;
}

function parseCliInput(args: string[]): CreateTableInput {
  return {
    schema: optionalArg(args, "--schema") ?? "public",
    name: requiredArg(args, "--name"),
    columns: parseColumns(optionalArg(args, "--columns")),
    enableRls: !flag(args, "--no-rls"),
  };
}

export const tool: StudioToolDefinition<CreateTableInput, { sql: string; filename: string }> = {
  id: "studio-create-table",
  async run(ctx, input) {
    return runCreateTable(ctx, input);
  },
  cli: {
    command: "studio-create-table",
    description: "Generate CREATE TABLE migration",
    help: HELP,
    parseArgs: (args) => parseCliInput(args),
    onSuccess: (result) => ui.success(`Written ${result.filename}`),
  },
  http: {
    method: "POST",
    path: "/api/studio/scaffold/create-table",
    parseRequest: async (req) => {
      const input = await readJsonBody(req) as Partial<CreateTableInput>;
      if (!input.name || !Array.isArray(input.columns)) {
        throw new Error("name and columns[] are required");
      }
      return {
        schema: input.schema ?? "public",
        name: String(input.name),
        columns: input.columns,
        primaryKey: Array.isArray(input.primaryKey) ? input.primaryKey : undefined,
        enableRls: input.enableRls !== false,
      };
    },
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "Create Table",
  whatItDoes: "Builds a migration that creates a new table, columns, and optional RLS enablement.",
  whenToUse: "Use when introducing a brand new table in your schema.",
  whatItNeeds: ["Table name", "Column definitions"],
  whatItProduces: ["New SQL migration file with CREATE TABLE"],
  audience: "backend-dev",
  controlModes: ["assisted","loose"],
};





