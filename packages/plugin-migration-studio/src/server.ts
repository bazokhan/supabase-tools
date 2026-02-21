import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import type { PluginContext } from "@sbtools/sdk";
import { analyzeMigrationSql, createPgClient, disconnectClient, readArtifactOrNull, scanMigrationFiles, testConnection, writeArtifact } from "@sbtools/sdk";
import type { RouteHandler } from "./types.js";
import { STUDIO_ARTIFACTS } from "./artifacts/constants.js";
import { loadSchema } from "./schema-loader.js";
import { TEMPLATES } from "./templates.js";
import { STUDIO_TOOLS_BY_ROUTE, STUDIO_TOOLS_BY_ID } from "./tools/discovery.js";
import { STUDIO_WORKFLOWS_BY_ID } from "./workflows/discovery.js";
import { loadWorkflowRun, resumeWorkflow, startWorkflow } from "./engine/runner.js";
import { ADOPT_BACKEND_WORKFLOW_ID } from "./workflows/adopt-backend.workflow.js";
import { getCatalog, parseCatalogFilters } from "./catalog.js";

const WATCH_STAMP_PATH_REL = path.join("watch", "last-event.json");
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function sendError(res: http.ServerResponse, error: unknown): void {
  const e = error as { message?: string; status?: number; code?: string };
  const message = e.message ?? String(error);
  const status = e.status ?? (/required|invalid|must/i.test(message) ? 400 : 500);
  const payload = e.code ? { error: message, code: e.code } : { error: message };
  sendJson(res, status, payload);
}

function buildWorkflowRegistry(workflowId: string): Record<string, (ctx: PluginContext) => Promise<void>> {
  const workflow = STUDIO_WORKFLOWS_BY_ID.get(workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
  const required = new Set(workflow.steps.map((step) => step.tool));
  const entries = Array.from(STUDIO_TOOLS_BY_ID.values())
    .filter((tool) => required.has(tool.id))
    .map((tool) => [
      tool.id,
      async (ctx: PluginContext) => {
        await tool.run(ctx, undefined);
      },
    ] as const);
  return Object.fromEntries(entries);
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
}

function generateMigrationFilename(description?: string): string {
  const now = new Date();
  const ts =
    now.getFullYear().toString().padStart(4, "0") +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0") +
    now.getHours().toString().padStart(2, "0") +
    now.getMinutes().toString().padStart(2, "0") +
    now.getSeconds().toString().padStart(2, "0");
  const suffix = description
    ? description.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "")
    : "migration";
  return `${ts}_${suffix || "migration"}.sql`;
}

const handleIndex: RouteHandler = async (_req, res) => {
  sendJson(res, 200, { service: "migration-studio", mode: "server-only", ui: "Open /migration-studio in ui-web dashboard" });
};

const handleAnalyze: RouteHandler = async (req, res) => {
  try {
    const body = await readBody(req);
    const { sql } = JSON.parse(body);
    sendJson(res, 200, analyzeMigrationSql(sql || ""));
  } catch (e) {
    sendError(res, e);
  }
};

function parsePgErrorLine(err: string): number | undefined {
  const lineMatch = err.match(/(?:^|\n)LINE\s+(\d+)[:\s]|\(line\s+(\d+)\)/i);
  return lineMatch ? parseInt(lineMatch[1] ?? lineMatch[2] ?? "0", 10) : undefined;
}

function prepareMigrationSql(sql: string): string {
  const alreadyWrapped = /^\s*BEGIN\s*;/i.test(sql.trimStart());
  if (alreadyWrapped) return sql;
  const trimmed = sql.trimEnd();
  const needsSemicolon = trimmed.length > 0 && !trimmed.endsWith(";");
  return `BEGIN;\n${sql}${needsSemicolon ? ";" : ""}\nCOMMIT;`;
}

async function validateSql(sql: string): Promise<{ valid: boolean; error?: string; line?: number; dbConnected: boolean }> {
  if (!sql?.trim()) return { valid: true, dbConnected: false };
  if (sql.length > 50_000) return { valid: true, dbConnected: false };
  const client = createPgClient();
  try {
    const ok = await testConnection(client);
    if (!ok) return { valid: true, dbConnected: false };
    await client.query(prepareMigrationSql(sql).replace("COMMIT;", "ROLLBACK;"));
    await disconnectClient(client);
    return { valid: true, dbConnected: true };
  } catch (e) {
    try {
      await client.query("ROLLBACK").catch(() => undefined);
      await disconnectClient(client);
    } catch {
      // ignore
    }
    const msg = (e as { message?: string }).message ?? String(e);
    if (msg.includes("connect") || msg.includes("ECONNREFUSED") || msg.includes("timeout")) {
      return { valid: true, dbConnected: false };
    }
    return { valid: false, error: msg, line: parsePgErrorLine(msg), dbConnected: true };
  }
}

const handleValidate: RouteHandler = async (req, res) => {
  try {
    const body = await readBody(req);
    const { sql } = JSON.parse(body);
    sendJson(res, 200, await validateSql(sql || ""));
  } catch (e) {
    sendJson(res, 500, { valid: false, error: (e as Error).message });
  }
};

function getMigrationStatus(ctx: PluginContext): Map<string, string> {
  const artifact = readArtifactOrNull(ctx, "migration.analysis", "1.0.0");
  const byStatus = new Map<string, string>();
  const data = artifact?.data as { migrations?: { filename: string; status: string }[] } | undefined;
  for (const m of data?.migrations || []) byStatus.set(m.filename, m.status);
  return byStatus;
}

const handleSave: RouteHandler = async (req, res, ctx) => {
  try {
    const body = await readBody(req);
    const { sql, description, filename: overwriteFilename } = JSON.parse(body);
    if (!(typeof sql === "string" && sql.trim())) return sendJson(res, 400, { error: "SQL is required" });

    const validation = await validateSql(sql);
    if (validation.valid === false && validation.dbConnected) {
      return sendJson(res, 400, { error: validation.error ?? "Invalid SQL", line: validation.line });
    }

    const migrationsDir = ctx.paths.migrations;
    if (!fs.existsSync(migrationsDir)) fs.mkdirSync(migrationsDir, { recursive: true });

    let filename: string;
    if (typeof overwriteFilename === "string" && overwriteFilename.trim()) {
      const name = overwriteFilename.trim();
      if (!name.endsWith(".sql") || name.includes("..") || name.includes("/") || name.includes("\\")) {
        return sendJson(res, 400, { error: "Invalid filename for overwrite" });
      }
      const filePath = path.join(migrationsDir, name);
      if (!fs.existsSync(filePath)) return sendJson(res, 400, { error: "Migration file not found" });
      const status = getMigrationStatus(ctx).get(name) || "pending";
      if (status === "applied") return sendJson(res, 400, { error: "Cannot overwrite applied migration" });
      filename = name;
      fs.writeFileSync(filePath, sql.trimEnd() + "\n", "utf8");
    } else {
      filename = generateMigrationFilename(description);
      fs.writeFileSync(path.join(migrationsDir, filename), sql.trimEnd() + "\n", "utf8");
    }

    sendJson(res, 200, { filename, filePath: path.join(migrationsDir, filename) });
  } catch (e) {
    sendError(res, e);
  }
};

let schemaCache: Awaited<ReturnType<typeof loadSchema>> | null = null;
const sseClients = new Set<http.ServerResponse>();
let fsBridgeStarted = false;
const fsBridgeWatchers: fs.FSWatcher[] = [];

function broadcastRefresh(reason: string): void {
  const payload = JSON.stringify({ type: "refresh", reason, at: new Date().toISOString() });
  for (const res of sseClients) {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(res);
    }
  }
}

function invalidateStudioCaches(reason: string): void {
  schemaCache = null;
  broadcastRefresh(reason);
}

const handleSchema: RouteHandler = async (_req, res, ctx) => {
  if (!schemaCache) schemaCache = await loadSchema(ctx);
  sendJson(res, 200, schemaCache);
};

const handleTemplates: RouteHandler = async (_req, res) => sendJson(res, 200, { templates: TEMPLATES });
const handleHealth: RouteHandler = async (_req, res) => sendJson(res, 200, { ok: true });

const handleEvents: RouteHandler = async (_req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    ...CORS_HEADERS,
  });
  res.write(`data: ${JSON.stringify({ type: "connected", at: new Date().toISOString() })}\n\n`);
  sseClients.add(res);
  res.on("close", () => sseClients.delete(res));
};

const handleMigrations: RouteHandler = async (_req, res, ctx) => {
  const files = scanMigrationFiles(ctx.paths.migrations);
  const byStatus = getMigrationStatus(ctx);
  sendJson(res, 200, {
    migrations: files.map((f) => ({ filename: f.filename, status: byStatus.get(f.filename) || "pending", sizeBytes: f.sizeBytes })),
  });
};

const handleMigrationFile: RouteHandler = async (req, res, ctx) => {
  const match = (req.url ?? "").match(/\/api\/migration\/([^/?#]+)/);
  const filename = match ? decodeURIComponent(match[1]) : "";
  if (!filename || filename.includes("..") || !filename.endsWith(".sql")) return sendJson(res, 400, { error: "Invalid filename" });
  const filePath = path.join(ctx.paths.migrations, filename);
  if (!fs.existsSync(filePath)) return sendJson(res, 404, { error: "Not found" });
  sendJson(res, 200, { filename, sql: fs.readFileSync(filePath, "utf8") });
};

function computeSnapshotHash(snapshot: { entities?: Array<{ id: string; columns?: Array<{ name: string }> }>; policies?: Array<{ id: string }> }): string {
  const payload = JSON.stringify({
    entities: (snapshot.entities ?? []).map((e) => ({ id: e.id, columns: (e.columns ?? []).map((c) => c.name) })),
    policies: (snapshot.policies ?? []).map((p) => p.id),
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

const handleApply: RouteHandler = async (_req, res, ctx) => {
  let gateEnv = readArtifactOrNull<{ status: string; blocking: Array<{ code: string; message: string; severity?: string }> }>(
    ctx,
    STUDIO_ARTIFACTS.RELEASE_GATE.id,
    STUDIO_ARTIFACTS.RELEASE_GATE.version
  );
  let effectiveGate = gateEnv?.data;
  if (effectiveGate?.status === "fail") {
    try {
      const runSqlParseTool = STUDIO_TOOLS_BY_ID.get("studio-sql-parse");
      const runRlsTool = STUDIO_TOOLS_BY_ID.get("studio-rls-check");
      const runLintTool = STUDIO_TOOLS_BY_ID.get("studio-lint");
      const runRpcTool = STUDIO_TOOLS_BY_ID.get("studio-rpc-lint");
      const runGateTool = STUDIO_TOOLS_BY_ID.get("studio-release-gate");
      if (runSqlParseTool) await runSqlParseTool.run(ctx, undefined);
      if (runRlsTool) await runRlsTool.run(ctx, undefined);
      if (runLintTool) await runLintTool.run(ctx, undefined);
      if (runRpcTool) await runRpcTool.run(ctx, undefined);
      if (runGateTool) effectiveGate = await runGateTool.run(ctx, undefined) as typeof effectiveGate;
    } catch {
      // keep original gate
    }
  }

  if (effectiveGate?.status === "fail") {
    const blocking = effectiveGate.blocking ?? [];
    const rlsCount = blocking.filter((b) => b.code === "RLS_GAP").length;
    const error = rlsCount === blocking.length
      ? `${blocking.length} RLS gap(s) — add policies in Schema Builder → RLS Policies, then try again.`
      : `Release gate failed — ${blocking.length} blocking issue(s). Fix in Schema Builder or Adoption page.`;
    return sendJson(res, 422, { success: false, gateBlocked: true, error, blocking });
  }

  const gateWarning = gateEnv == null ? "No release gate artifact found. Run studio-release-gate before applying to production." : undefined;
  let snapshotStale = false;
  const planEnv = readArtifactOrNull<{ snapshotHash?: string }>(ctx, STUDIO_ARTIFACTS.MIGRATION_PLAN.id, STUDIO_ARTIFACTS.MIGRATION_PLAN.version);
  if (planEnv?.data?.snapshotHash) {
    const snapshotEnv = readArtifactOrNull<{ entities?: unknown[]; policies?: unknown[] }>(ctx, STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id, STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.version);
    if (snapshotEnv?.data) snapshotStale = computeSnapshotHash(snapshotEnv.data as Parameters<typeof computeSnapshotHash>[0]) !== planEnv.data.snapshotHash;
  }

  try {
    const cliPath = path.join(ctx.toolsDir, "dist", "cli.js");
    const output = execSync(`node "${cliPath}" migrate`, {
      cwd: ctx.projectRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    writeArtifact(ctx, {
      id: STUDIO_ARTIFACTS.APPLY_LOG.id,
      version: STUDIO_ARTIFACTS.APPLY_LOG.version,
      producer: "apply",
      generatedAt: new Date().toISOString(),
      data: { appliedAt: new Date().toISOString(), output: String(output).slice(0, 2000), success: true },
    });
    sendJson(res, 200, { success: true, output, gateWarning, snapshotStale: snapshotStale || undefined });
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string };
    sendJson(res, 500, { success: false, error: String(err.stderr || err.stdout || (e as Error).message).slice(-500) });
  }
};

const handleStudioIntentGraph: RouteHandler = async (_req, res, ctx) => {
  const env = readArtifactOrNull(ctx, STUDIO_ARTIFACTS.INTENT_GRAPH.id, STUDIO_ARTIFACTS.INTENT_GRAPH.version);
  sendJson(res, 200, env?.data ?? null);
};

const handleStudioAdoptStatus: RouteHandler = async (_req, res, ctx) => {
  const run = loadWorkflowRun(ctx);
  sendJson(res, 200, run ?? { status: "not_started" });
};

const handleStudioAdoptStart: RouteHandler = async (_req, res, ctx) => {
  try {
    const workflow = STUDIO_WORKFLOWS_BY_ID.get(ADOPT_BACKEND_WORKFLOW_ID);
    if (!workflow) throw new Error(`Workflow not found: ${ADOPT_BACKEND_WORKFLOW_ID}`);
    const run = await startWorkflow(workflow.id, workflow.steps, ctx, buildWorkflowRegistry(workflow.id));
    sendJson(res, 200, run);
  } catch (e) {
    sendError(res, e);
  }
};

const handleStudioAdoptResume: RouteHandler = async (_req, res, ctx) => {
  try {
    const workflow = STUDIO_WORKFLOWS_BY_ID.get(ADOPT_BACKEND_WORKFLOW_ID);
    if (!workflow) throw new Error(`Workflow not found: ${ADOPT_BACKEND_WORKFLOW_ID}`);
    const run = loadWorkflowRun(ctx);
    if (!run || run.status !== "waiting_checkpoint") {
      return sendJson(res, 400, { error: "No workflow run in waiting_checkpoint state" });
    }
    sendJson(res, 200, await resumeWorkflow(run, workflow.steps, ctx, buildWorkflowRegistry(workflow.id)));
  } catch (e) {
    sendError(res, e);
  }
};

const handleStudioCatalog: RouteHandler = async (req, res) => {
  const url = new URL(req.url ?? "/api/studio/catalog", "http://localhost");
  const filters = parseCatalogFilters({
    audience: url.searchParams.get("audience") ?? undefined,
    mode: url.searchParams.get("mode") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
  });
  sendJson(res, 200, getCatalog(filters));
};

const handleToolRoute: RouteHandler = async (req, res, ctx) => {
  const pathname = (req.url ?? "/").split("?")[0];
  const method = req.method ?? "GET";
  const tool = STUDIO_TOOLS_BY_ROUTE.get(`${method}:${pathname}`);
  if (!tool || !tool.http) return sendJson(res, 404, { error: "Not found" });
  try {
    const input = await tool.http.parseRequest(req, ctx);
    const result = await tool.run(ctx, input);
    const payload = tool.http.toResponse ? await tool.http.toResponse(result, ctx) : result;
    sendJson(res, 200, payload);
    broadcastRefresh(`tool:${tool.id}`);
  } catch (e) {
    sendError(res, e);
  }
};

function initStudioFsBridge(ctx: PluginContext): void {
  if (fsBridgeStarted) return;
  fsBridgeStarted = true;
  const watchStampPath = path.join(ctx.sbtDataDir, WATCH_STAMP_PATH_REL);
  const artifactPath = path.join(ctx.sbtDataDir, "artifacts", "migration.analysis", "1.0.0", "latest.json");
  fs.mkdirSync(path.dirname(watchStampPath), { recursive: true });
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.mkdirSync(ctx.paths.migrations, { recursive: true });

  const watchDir = (dir: string, onChange: (filename: string) => void) => {
    const watcher = fs.watch(dir, (_eventType, filename) => onChange(filename?.toString() ?? ""));
    fsBridgeWatchers.push(watcher);
  };

  watchDir(path.dirname(watchStampPath), (filename) => {
    if (filename === path.basename(watchStampPath)) invalidateStudioCaches("watch_event");
  });
  watchDir(path.dirname(artifactPath), (filename) => {
    if (filename === path.basename(artifactPath)) invalidateStudioCaches("artifact_changed");
  });
  watchDir(ctx.paths.migrations, (filename) => {
    if (filename.endsWith(".sql")) invalidateStudioCaches("migration_file_changed");
  });
  process.once("exit", () => fsBridgeWatchers.forEach((w) => w.close()));
}

export function createRequestHandler(ctx: PluginContext): (req: http.IncomingMessage, res: http.ServerResponse) => void {
  initStudioFsBridge(ctx);

  const routes = new Map<string, RouteHandler>([
    ["GET:/", handleIndex],
    ["GET:/index.html", handleIndex],
    ["GET:/api/health", handleHealth],
    ["GET:/api/events", handleEvents],
    ["GET:/api/schema", handleSchema],
    ["GET:/api/templates", handleTemplates],
    ["GET:/api/migrations", handleMigrations],
    ["POST:/api/analyze", handleAnalyze],
    ["POST:/api/validate", handleValidate],
    ["POST:/api/save", handleSave],
    ["POST:/api/apply", handleApply],
    ["GET:/api/studio/intent-graph", handleStudioIntentGraph],
    ["GET:/api/studio/adopt/status", handleStudioAdoptStatus],
    ["GET:/api/studio/catalog", handleStudioCatalog],
    ["POST:/api/studio/adopt/start", handleStudioAdoptStart],
    ["POST:/api/studio/adopt/resume", handleStudioAdoptResume],
  ]);

  for (const [key] of STUDIO_TOOLS_BY_ROUTE) routes.set(key, handleToolRoute);

  return async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }
    for (const [key, value] of Object.entries(CORS_HEADERS)) res.setHeader(key, value);

    const pathname = (req.url ?? "/").split("?")[0];
    const method = req.method ?? "GET";
    let handler = routes.get(`${method}:${pathname}`);
    if (!handler && method === "GET" && pathname.startsWith("/api/migration/") && pathname !== "/api/migration/") {
      handler = handleMigrationFile;
    }

    if (!handler) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    await handler(req, res, ctx);
  };
}
