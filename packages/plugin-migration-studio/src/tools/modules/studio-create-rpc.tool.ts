import fs from "node:fs";
import path from "node:path";
import { ui } from "@sbtools/sdk";
import type { CreateRpcInput } from "../core/studio-create-rpc.core.js";
import { runCreateRpc } from "../core/studio-create-rpc.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";
import { optionalArg, parseParams, readJsonBody, requiredArg } from "./module-utils.js";

const HELP = `
studio-create-rpc — Generate RPC function migration (schema: public)

Usage:
  sbt studio-create-rpc --name <name> --params "user_id uuid" --returns "TABLE(id uuid)" --language sql --body-file <path>

Same as studio-add-function but forces schema public for PostgREST.
`;

function readBodyFromArgs(args: string[], projectRoot: string): string {
  const bodyFile = optionalArg(args, "--body-file");
  const bodyInline = optionalArg(args, "--body");
  if (bodyFile) return fs.readFileSync(path.resolve(projectRoot, bodyFile), "utf8");
  if (bodyInline) return bodyInline;
  throw new Error("--body-file or --body required");
}

function parseCliInput(args: string[], projectRoot: string): CreateRpcInput {
  return {
    name: requiredArg(args, "--name"),
    params: parseParams(optionalArg(args, "--params")),
    returnType: requiredArg(args, "--returns"),
    language: (optionalArg(args, "--language") ?? "sql") as "sql" | "plpgsql",
    body: readBodyFromArgs(args, projectRoot),
  };
}

export const tool: StudioToolDefinition<CreateRpcInput, { sql: string; filename: string }> = {
  id: "studio-create-rpc",
  async run(ctx, input) {
    return runCreateRpc(ctx, input);
  },
  cli: {
    command: "studio-create-rpc",
    description: "Generate RPC migration (schema: public)",
    help: HELP,
    parseArgs: (args, ctx) => parseCliInput(args, ctx.projectRoot),
    onSuccess: (result) => ui.success(`Written ${result.filename}`),
  },
  http: {
    method: "POST",
    path: "/api/studio/scaffold/create-rpc",
    parseRequest: async (req) => {
      const input = await readJsonBody(req) as Partial<CreateRpcInput & { security?: "invoker" | "definer" }>;
      if (!input.name || !input.returnType || !input.body) {
        throw new Error("name, returnType, and body required");
      }
      return {
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
  title: "Create RPC Function",
  whatItDoes: "Creates a public RPC function migration so PostgREST can expose it as an API endpoint.",
  whenToUse: "Use when frontend/backend needs a custom database action exposed as RPC.",
  whatItNeeds: ["RPC function name", "Return type", "Function body"],
  whatItProduces: ["New SQL migration file for a public RPC function"],
  audience: "backend-dev",
  controlModes: ["assisted","loose"],
};





