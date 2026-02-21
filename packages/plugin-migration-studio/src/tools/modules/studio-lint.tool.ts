import { ui } from "@sbtools/sdk";
import { runMigrationLint } from "../core/studio-migration-lint.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";

const HELP = `
studio-lint — Lint migration files for risky patterns

Usage:
  sbt studio-lint
`;

export const tool: StudioToolDefinition<void, Awaited<ReturnType<typeof runMigrationLint>>> = {
  id: "studio-lint",
  async run(ctx) {
    return runMigrationLint(ctx);
  },
  cli: {
    command: "studio-lint",
    aliases: ["studio-migration-lint"],
    description: "Lint migration files for risky patterns",
    help: HELP,
    parseArgs: () => undefined,
    onSuccess: (result) => {
      if (result.status === "pass") {
        ui.success(`Migration lint passed — ${result.findings.length} finding(s)`);
        return;
      }
      ui.detail(`Migration lint failed — ${result.errorCount} error(s), ${result.warningCount} warning(s):`);
      for (const f of result.findings) {
        ui.detail(`  [${f.severity.toUpperCase()}] ${f.code}: ${f.message}`);
      }
      throw new Error("Migration lint errors detected");
    },
  },
  http: {
    method: "POST",
    path: "/api/studio/migration-lint",
    parseRequest: async () => undefined,
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "Migration Lint",
  whatItDoes: "Scans migration SQL for risky patterns and naming/safety issues.",
  whenToUse: "Run before applying migrations to reduce operational risk.",
  whatItNeeds: ["studio.sql.ast artifact"],
  whatItProduces: ["studio.migration.lint artifact"],
  audience: "backend-dev",
  controlModes: ["managed","assisted","loose"],
};





