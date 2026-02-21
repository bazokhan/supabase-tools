import { ui } from "@sbtools/sdk";
import { runMigrationPlan } from "../core/studio-migration-plan.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";

const HELP = `
studio-migration-plan — Diff intent graph vs DB snapshot and produce a change plan

Usage:
  sbt studio-migration-plan
`;

export const tool: StudioToolDefinition<void, Awaited<ReturnType<typeof runMigrationPlan>>> = {
  id: "studio-migration-plan",
  async run(ctx) {
    return runMigrationPlan(ctx);
  },
  cli: {
    command: "studio-migration-plan",
    description: "Diff intent graph vs snapshot → migration plan",
    help: HELP,
    parseArgs: () => undefined,
    onSuccess: (result) => {
      ui.success(`Migration plan: ${result.totalChanges} change(s), ${result.destructiveCount} destructive`);
      for (const c of result.changes) {
        const prefix = c.requiresConfirmation ? "⚠" : "·";
        ui.detail(`  ${prefix} [${c.changeClass}] ${c.objectId}`);
      }
    },
  },
  http: {
    method: "POST",
    path: "/api/studio/migration-plan",
    parseRequest: async () => undefined,
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "Migration Change Plan",
  whatItDoes: "Compares intent graph against schema snapshot and lists required changes.",
  whenToUse: "Use when preparing migration rollout and impact review.",
  whatItNeeds: ["studio.intent.graph artifact", "studio.schema.snapshot artifact"],
  whatItProduces: ["studio.migration.plan artifact"],
  audience: "backend-dev",
  controlModes: ["managed","assisted"],
};





