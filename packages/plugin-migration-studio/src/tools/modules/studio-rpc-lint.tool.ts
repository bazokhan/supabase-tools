import { ui } from "@sbtools/sdk";
import { runRpcLint } from "../core/studio-rpc-lint.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";

const HELP = `
studio-rpc-lint — Lint RPC/function definitions for security issues

Usage:
  sbt studio-rpc-lint
`;

export const tool: StudioToolDefinition<void, Awaited<ReturnType<typeof runRpcLint>>> = {
  id: "studio-rpc-lint",
  async run(ctx) {
    return runRpcLint(ctx);
  },
  cli: {
    command: "studio-rpc-lint",
    description: "Lint RPC/function definitions for security issues",
    help: HELP,
    parseArgs: () => undefined,
    onSuccess: (result) => {
      const withWarnings = result.functions.filter((f) => f.lintWarnings.length > 0);
      if (withWarnings.length === 0) {
        ui.success(`RPC lint passed — ${result.functions.length} function(s) checked, no issues`);
        return;
      }
      ui.detail(`RPC lint — ${result.securityDefinerCount} SECURITY DEFINER, ${result.missingSearchPathCount} missing search_path:`);
      for (const f of withWarnings) ui.detail(`  ${f.functionId}: ${f.lintWarnings.join("; ")}`);
    },
  },
  http: {
    method: "POST",
    path: "/api/studio/rpc-lint",
    parseRequest: async () => undefined,
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "RPC Security Lint",
  whatItDoes: "Reviews functions and RPC definitions for common security weaknesses.",
  whenToUse: "Run before release to catch risky security-definer and search_path issues.",
  whatItNeeds: ["studio.intent.graph artifact"],
  whatItProduces: ["studio.rpc.plan artifact"],
  audience: "backend-dev",
  controlModes: ["managed","assisted"],
};





