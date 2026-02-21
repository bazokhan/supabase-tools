import fs from "node:fs";
import path from "node:path";
import { readArtifactOrNull, ui } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../artifacts/constants.js";
import { runSqlParse } from "../core/studio-sql-parse.core.js";
import type { StudioToolDefinition, ToolAudienceMetadata } from "../tool-definition.js";

interface SqlParseSummary {
  files: number;
  totalStatements: number;
  totalOpaqueBlocks: number;
}

const HELP = `
studio-sql-parse — Parse migration files, write studio.sql.ast

Usage:
  sbt studio-sql-parse

Scans supabase/migrations/ and extracts structured intent nodes.
`;

function summarize(ctxPathMigrations: string, ctx: Parameters<typeof runSqlParse>[0]): SqlParseSummary {
  const env = readArtifactOrNull(ctx, STUDIO_ARTIFACTS.SQL_AST.id, STUDIO_ARTIFACTS.SQL_AST.version);
  const data = env?.data as { files?: unknown[]; totalStatements?: number; totalOpaqueBlocks?: number } | undefined;
  return {
    files: data?.files?.length ?? (fs.existsSync(ctxPathMigrations) ? fs.readdirSync(ctxPathMigrations).filter((f) => f.endsWith(".sql")).length : 0),
    totalStatements: data?.totalStatements ?? 0,
    totalOpaqueBlocks: data?.totalOpaqueBlocks ?? 0,
  };
}

export const tool: StudioToolDefinition<void, SqlParseSummary> = {
  id: "studio-sql-parse",
  workflowEnabled: true,
  async run(ctx) {
    const migrationsDir = ctx.paths?.migrations ?? path.join(ctx.projectRoot, "supabase", "migrations");
    await runSqlParse(ctx);
    return summarize(migrationsDir, ctx);
  },
  cli: {
    command: "studio-sql-parse",
    description: "Parse migrations → studio.sql.ast",
    help: HELP,
    parseArgs: () => undefined,
    onSuccess: (result) => {
      ui.success(`Parsed ${result.totalStatements} statements, ${result.totalOpaqueBlocks} opaque blocks`);
      ui.detail(`Written to .sbt/artifacts/${STUDIO_ARTIFACTS.SQL_AST.id}/1.0.0/latest.json`);
    },
  },
  http: {
    method: "POST",
    path: "/api/studio/sql-parse",
    parseRequest: async () => undefined,
    toResponse: (result) => result,
  },
};

export const metadata: ToolAudienceMetadata = {
  title: "Migration SQL Parser",
  whatItDoes: "Reads migration SQL files and extracts structured statements for analysis.",
  whenToUse: "Run this before linting, planning, or adoption comparisons.",
  whatItNeeds: ["Migration files in supabase/migrations"],
  whatItProduces: ["studio.sql.ast artifact"],
  audience: "backend-dev",
  controlModes: ["assisted","loose"],
};





