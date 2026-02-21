import { readArtifactOrNull, ui } from "@sbtools/sdk";
import type { PluginContext } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../artifacts/constants.js";
import { runIntrospect } from "../core/studio-introspect.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";

interface IntrospectSummary {
  entities: number;
  policies: number;
  infrastructure: number;
}

const HELP = `
studio-introspect — Query live DB, write studio.schema.snapshot

Usage:
  sbt studio-introspect

Connects to the database and captures tables, policies, extensions.
`;

function summarize(ctx: PluginContext): IntrospectSummary {
  const env = readArtifactOrNull(
    ctx,
    STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id,
    STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.version
  );
  const data = env?.data as { entities?: unknown[]; policies?: unknown[]; infrastructure?: unknown[] } | undefined;
  return {
    entities: data?.entities?.length ?? 0,
    policies: data?.policies?.length ?? 0,
    infrastructure: data?.infrastructure?.length ?? 0,
  };
}

export const tool: StudioToolDefinition<void, IntrospectSummary> = {
  id: "studio-introspect",
  workflowEnabled: true,
  async run(ctx) {
    await runIntrospect(ctx);
    return summarize(ctx);
  },
  cli: {
    command: "studio-introspect",
    description: "Query DB → studio.schema.snapshot",
    help: HELP,
    parseArgs: () => undefined,
    onSuccess: (result) => {
      ui.success(`Captured ${result.entities} tables, ${result.policies} policies, ${result.infrastructure} extensions`);
      ui.detail(`Written to .sbt/artifacts/${STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id}/1.0.0/latest.json`);
    },
  },
  http: {
    method: "POST",
    path: "/api/studio/introspect",
    parseRequest: async () => undefined,
    toResponse: (result) => result,
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "Database Introspection",
  whatItDoes: "Scans your live database and stores a snapshot of tables, policies, and extensions.",
  whenToUse: "Use this before adoption, planning, or validation so tools work with current database state.",
  whatItNeeds: ["Database connection configured in supabase-tools config"],
  whatItProduces: ["studio.schema.snapshot artifact"],
  audience: "backend-dev",
  controlModes: ["assisted","loose"],
};





