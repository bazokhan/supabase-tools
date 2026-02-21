import fs from "node:fs";
import path from "node:path";
import { ui } from "@sbtools/sdk";
import type { AddFunctionInput } from "../core/studio-add-function.core.js";
import { runAddFunction } from "../core/studio-add-function.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";
import { optionalArg, parseParams, readJsonBody, requiredArg } from "./module-utils.js";

const HELP = `
studio-add-function — Generate CREATE FUNCTION migration

Usage:
  sbt studio-add-function --schema public --name <name> --returns <type> --language plpgsql --body-file <path> [--security definer]

Options:
  --schema      Schema (default: public)
  --name        Function name
  --params      Params string, e.g. "user_id uuid"
  --returns     Return type
  --language    sql | plpgsql
  --body-file   Path to SQL file with function body
  --body        Inline body (single line)
  --security    invoker | definer (default: invoker)
`;

function readBodyFromArgs(args: string[], projectRoot: string): string {
  const bodyFile = optionalArg(args, "--body-file");
  const bodyInline = optionalArg(args, "--body");
  if (bodyFile) return fs.readFileSync(path.resolve(projectRoot, bodyFile), "utf8");
  if (bodyInline) return bodyInline;
  throw new Error("--body-file or --body required");
}

function parseCliInput(args: string[], projectRoot: string): AddFunctionInput {
  return {
    schema: optionalArg(args, "--schema") ?? "public",
    name: requiredArg(args, "--name"),
    params: parseParams(optionalArg(args, "--params")),
    returnType: requiredArg(args, "--returns"),
    language: (optionalArg(args, "--language") ?? "plpgsql") as "sql" | "plpgsql",
    body: readBodyFromArgs(args, projectRoot),
    security: optionalArg(args, "--security") === "definer" ? "definer" : "invoker",
  };
}

export const tool: StudioToolDefinition<AddFunctionInput, { sql: string; filename: string }> = {
  id: "studio-add-function",
  async run(ctx, input) {
    return runAddFunction(ctx, input);
  },
  cli: {
    command: "studio-add-function",
    description: "Generate CREATE FUNCTION migration",
    help: HELP,
    parseArgs: (args, ctx) => parseCliInput(args, ctx.projectRoot),
    onSuccess: (result) => ui.success(`Written ${result.filename}`),
  },
  http: {
    method: "POST",
    path: "/api/studio/scaffold/add-function",
    parseRequest: async (req) => {
      const input = await readJsonBody(req) as Partial<AddFunctionInput>;
      if (!input.name || !input.returnType || !input.body) {
        throw new Error("name, returnType, and body required");
      }
      return {
        schema: input.schema ?? "public",
        name: String(input.name),
        params: Array.isArray(input.params) ? input.params : [],
        returnType: String(input.returnType),
        language: input.language === "sql" ? "sql" : "plpgsql",
        body: String(input.body),
        security: input.security === "definer" ? "definer" : "invoker",
      };
    },
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "Create Database Function",
  whatItDoes: "Generates a migration that creates or replaces a SQL/PLpgSQL function.",
  whenToUse: "Use when adding reusable database logic or backend calculations.",
  whatItNeeds: ["Function name", "Return type", "Function body"],
  whatItProduces: ["New SQL migration file with CREATE OR REPLACE FUNCTION"],
  audience: "backend-dev",
  controlModes: ["assisted","loose"],
};





