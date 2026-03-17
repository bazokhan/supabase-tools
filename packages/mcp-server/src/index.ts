#!/usr/bin/env node
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { STUDIO_TOOLS } from "@sbtools/plugin-migration-studio/tools/discovery";
import { getCatalog } from "@sbtools/plugin-migration-studio/catalog";
import { STUDIO_ARTIFACTS } from "@sbtools/plugin-migration-studio/artifacts/constants";
import { readArtifactOrNull, scanMigrationFiles } from "@sbtools/sdk";
import { buildContext } from "./context.js";

// Parse --cwd flag BEFORE transport takes over stdio
const cwdFlagIdx = process.argv.indexOf("--cwd");
const cwdOverride = cwdFlagIdx >= 0 ? process.argv[cwdFlagIdx + 1] : undefined;

const ctx = buildContext(cwdOverride);

const server = new McpServer({ name: "sbtools-studio", version: "0.9.0" });

/**
 * Create a fake IncomingMessage that yields the given body as JSON.
 * Lets tools reuse their existing http.parseRequest logic without changes.
 */
function makeFakeRequest(body: unknown): IncomingMessage {
  const bodyStr = JSON.stringify(body);
  const stream = new Readable({ read() {} });
  stream.push(bodyStr);
  stream.push(null);
  const req = stream as unknown as IncomingMessage;
  const r = req as unknown as Record<string, unknown>;
  r.url = "/";
  r.method = "POST";
  r.headers = { "content-type": "application/json" };
  return req;
}

// Register all studio tools as MCP tools
for (const tool of STUDIO_TOOLS) {
  const m = tool.metadata;
  const parts: string[] = [m.whatItDoes, m.whenToUse];
  if (m.whatItNeeds.length > 0) parts.push(`Needs: ${m.whatItNeeds.join(", ")}`);
  if (m.whatItProduces.length > 0) parts.push(`Produces: ${m.whatItProduces.join(", ")}`);
  if (m.audience) parts.push(`Audience: ${m.audience}`);
  if ((m.controlModes ?? []).length > 0) parts.push(`Modes: ${(m.controlModes ?? []).join(", ")}`);
  const description = parts.join("\n");

  if (tool.http) {
    const boundTool = tool;
    server.tool(
      tool.id,
      description,
      { input: z.record(z.unknown()).optional() },
      async ({ input }) => {
        const fakeReq = makeFakeRequest(input ?? {});
        const parsedInput = await boundTool.http!.parseRequest(fakeReq, ctx);
        const result = await boundTool.run(ctx, parsedInput);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      }
    );
  } else {
    const boundTool = tool;
    server.tool(
      tool.id,
      description,
      {},
      async () => {
        const result = await boundTool.run(ctx, undefined as never);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      }
    );
  }
}

// Resource: full tool/workflow catalog
server.resource(
  "catalog",
  "sbtools://studio/catalog",
  async () => {
    const catalog = getCatalog({});
    return {
      contents: [{
        uri: "sbtools://studio/catalog",
        text: JSON.stringify(catalog, null, 2),
        mimeType: "application/json",
      }],
    };
  }
);

// Resource: full intent graph artifact data
server.resource(
  "intent-graph",
  "sbtools://studio/intent-graph",
  async () => {
    const env = readArtifactOrNull(ctx, STUDIO_ARTIFACTS.INTENT_GRAPH.id, STUDIO_ARTIFACTS.INTENT_GRAPH.version);
    return {
      contents: [{
        uri: "sbtools://studio/intent-graph",
        text: JSON.stringify(env?.data ?? null, null, 2),
        mimeType: "application/json",
      }],
    };
  }
);

// Resource: single-call orientation summary for AI agents (mirrors server.ts handleLlmContext)
server.resource(
  "llm-context",
  "sbtools://studio/llm-context",
  async () => {
    const graph = readArtifactOrNull<{
      entities?: unknown[];
      policies?: unknown[];
      functions?: unknown[];
      mode?: string;
    }>(ctx, STUDIO_ARTIFACTS.INTENT_GRAPH.id, STUDIO_ARTIFACTS.INTENT_GRAPH.version);

    const releaseGate = readArtifactOrNull<{ status?: string; reasons?: unknown[] }>(
      ctx, STUDIO_ARTIFACTS.RELEASE_GATE.id, STUDIO_ARTIFACTS.RELEASE_GATE.version
    );

    const migrationLint = readArtifactOrNull<{ flags?: unknown[] }>(
      ctx, STUDIO_ARTIFACTS.MIGRATION_LINT.id, STUDIO_ARTIFACTS.MIGRATION_LINT.version
    );

    const migrations = scanMigrationFiles(ctx.paths.migrations);
    const catalog = getCatalog({});

    const intentGraphSummary = graph?.data
      ? {
          mode: (graph.data as { mode?: string }).mode ?? "unknown",
          entityCount: (graph.data.entities ?? []).length,
          managedCount: ((graph.data.entities ?? []) as { managedStatus?: string }[]).filter(
            (e) => e.managedStatus === "managed"
          ).length,
          assistedCount: ((graph.data.entities ?? []) as { managedStatus?: string }[]).filter(
            (e) => e.managedStatus === "assisted"
          ).length,
          opaqueCount: ((graph.data.entities ?? []) as { managedStatus?: string }[]).filter(
            (e) => e.managedStatus === "opaque"
          ).length,
          policyCount: (graph.data.policies ?? []).length,
          functionCount: (graph.data.functions ?? []).length,
          freshAt: graph.generatedAt,
        }
      : null;

    const result = {
      intentGraph: intentGraphSummary,
      releaseGate: releaseGate?.data
        ? {
            status: releaseGate.data.status,
            reasonCount: (releaseGate.data.reasons ?? []).length,
            freshAt: releaseGate.generatedAt,
          }
        : null,
      migrationLint: migrationLint?.data
        ? { flagCount: (migrationLint.data.flags ?? []).length, freshAt: migrationLint.generatedAt }
        : null,
      migrations: { totalCount: migrations.length },
      catalog: {
        toolCount: catalog.tools.length,
        workflowCount: catalog.workflows.length,
        tools: catalog.tools.map((t) => ({ id: t.id, whatItDoes: t.whatItDoes, whenToUse: t.whenToUse })),
        workflows: catalog.workflows.map((w) => ({ id: w.id, description: w.description, steps: w.steps })),
      },
    };

    return {
      contents: [{
        uri: "sbtools://studio/llm-context",
        text: JSON.stringify(result, null, 2),
        mimeType: "application/json",
      }],
    };
  }
);

// Hand off stdio to the MCP transport — no console.log after this point
const transport = new StdioServerTransport();
await server.connect(transport);
