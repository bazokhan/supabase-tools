import { ui } from "@sbtools/sdk";
import { runReleaseGate } from "../core/studio-release-gate.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";

const HELP = `
studio-release-gate — Aggregate validation results and produce a go/no-go gate

Usage:
  sbt studio-release-gate
`;

export const tool: StudioToolDefinition<void, Awaited<ReturnType<typeof runReleaseGate>>> = {
  id: "studio-release-gate",
  async run(ctx) {
    return runReleaseGate(ctx);
  },
  cli: {
    command: "studio-release-gate",
    description: "Aggregate validation → go/no-go gate",
    help: HELP,
    parseArgs: () => undefined,
    onSuccess: (gate) => {
      if (gate.status === "pass") {
        ui.success(`Release gate: PASS — ${gate.evidence.length} evidence artifact(s), ${gate.warnings.length} warning(s)`);
        for (const w of gate.warnings) ui.detail(`  Warning [${w.code}]: ${w.message}`);
        return;
      }
      ui.detail(`Release gate: FAIL — ${gate.blocking.length} blocking issue(s):`);
      for (const b of gate.blocking) ui.detail(`  [${b.severity.toUpperCase()}] ${b.code}: ${b.message}`);
      throw new Error("Release gate failed");
    },
  },
  http: {
    method: "POST",
    path: "/api/studio/release-gate",
    parseRequest: async () => undefined,
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "Release Gate",
  whatItDoes: "Combines lint and validation evidence into a release pass/fail decision.",
  whenToUse: "Run right before applying migrations, especially in production workflows.",
  whatItNeeds: ["Validation artifacts such as rls-check, rpc-lint, migration-lint"],
  whatItProduces: ["studio.release.gate artifact"],
  audience: "mixed",
  controlModes: ["managed","assisted"],
};





