import { ui } from "@sbtools/sdk";
import type { AddRlsPolicyInput } from "../core/studio-add-rls-policy.core.js";
import { runAddRlsPolicy } from "../core/studio-add-rls-policy.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";
import { flag, optionalArg, readJsonBody, requiredArg } from "./module-utils.js";

const HELP = `
studio-add-rls-policy — Generate CREATE POLICY migration

Usage:
  sbt studio-add-rls-policy --entity <schema.table> --name <policy_name> --command SELECT --roles authenticated [--using "auth.uid() = id"] [--with-check "..."] [--restrictive]

Options:
  --entity       Entity ID (e.g. public.users)
  --name         Policy name
  --command      SELECT | INSERT | UPDATE | DELETE | ALL
  --roles        Comma-separated role names (e.g. authenticated,service_role)
  --using        USING expression
  --with-check   WITH CHECK expression
  --restrictive  Use AS RESTRICTIVE (default: PERMISSIVE)
`;

function parseCliInput(args: string[]): AddRlsPolicyInput {
  const roles = requiredArg(args, "--roles").split(",").map((r) => r.trim()).filter(Boolean);
  return {
    entityId: requiredArg(args, "--entity"),
    policy: {
      name: requiredArg(args, "--name"),
      command: requiredArg(args, "--command") as AddRlsPolicyInput["policy"]["command"],
      roles,
      using: optionalArg(args, "--using"),
      withCheck: optionalArg(args, "--with-check"),
      permissive: !flag(args, "--restrictive"),
    },
  };
}

export const tool: StudioToolDefinition<AddRlsPolicyInput, { sql: string; filename: string }> = {
  id: "studio-add-rls-policy",
  async run(ctx, input) {
    return runAddRlsPolicy(ctx, input);
  },
  cli: {
    command: "studio-add-rls-policy",
    description: "Generate CREATE POLICY migration",
    help: HELP,
    parseArgs: (args) => parseCliInput(args),
    onSuccess: (result) => ui.success(`Written ${result.filename}`),
  },
  http: {
    method: "POST",
    path: "/api/studio/scaffold/add-rls-policy",
    parseRequest: async (req) => {
      const input = await readJsonBody(req) as Partial<AddRlsPolicyInput>;
      if (!input.entityId || !input.policy?.name || !input.policy.command || !Array.isArray(input.policy.roles)) {
        throw new Error("entityId and policy { name, command, roles } are required");
      }
      return {
        entityId: String(input.entityId),
        policy: {
          name: String(input.policy.name),
          command: input.policy.command,
          roles: input.policy.roles.map(String),
          using: input.policy.using != null ? String(input.policy.using) : undefined,
          withCheck: input.policy.withCheck != null ? String(input.policy.withCheck) : undefined,
          permissive: input.policy.permissive !== false,
        },
      };
    },
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "Add RLS Policy",
  whatItDoes: "Generates a migration that adds a Row Level Security policy to a table.",
  whenToUse: "Use when controlling who can read or write rows in a protected table.",
  whatItNeeds: ["Target table id", "Policy command", "Allowed roles"],
  whatItProduces: ["New SQL migration file with CREATE POLICY"],
  audience: "backend-dev",
  controlModes: ["managed","assisted"],
};





