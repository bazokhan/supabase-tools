import { ui } from "@sbtools/sdk";
import { runRlsCheck } from "../core/studio-rls-check.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";

const HELP = `
studio-rls-check — Analyze RLS coverage across all managed entities

Usage:
  sbt studio-rls-check
`;

export const tool: StudioToolDefinition<void, Awaited<ReturnType<typeof runRlsCheck>>> = {
  id: "studio-rls-check",
  async run(ctx) {
    return runRlsCheck(ctx);
  },
  cli: {
    command: "studio-rls-check",
    description: "Analyze RLS coverage for managed entities",
    help: HELP,
    parseArgs: () => undefined,
    onSuccess: (result) => {
      const report = result.report;
      if (report.status === "pass") {
        ui.success(`RLS check passed — ${report.entitiesChecked} entities checked, ${report.tablesWithRls} with RLS`);
      } else {
        ui.detail(`RLS check failed — ${report.gaps.length} gap(s) found:`);
        for (const gap of report.gaps) ui.detail(`  ${gap.entityId}: missing ${gap.missingCommands.join(", ")}`);
        throw new Error("RLS gaps detected");
      }
    },
  },
  http: {
    method: "POST",
    path: "/api/studio/rls-check",
    parseRequest: async () => undefined,
    toResponse: (result) => ({ report: result.report, plan: result.plan }),
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "RLS Coverage Check",
  whatItDoes: "Checks managed tables for missing Row Level Security command coverage.",
  whenToUse: "Run before release to catch data-access policy gaps.",
  whatItNeeds: ["studio.intent.graph artifact"],
  whatItProduces: ["studio.rls.report", "studio.rls.plan artifacts"],
  audience: "backend-dev",
  controlModes: ["managed","assisted"],
};




