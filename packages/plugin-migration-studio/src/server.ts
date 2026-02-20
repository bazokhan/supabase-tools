/**
 * HTTP server and route handlers for Migration Studio.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import type { PluginContext } from "@sbtools/sdk";
import { analyzeMigrationSql, createPgClient, testConnection, disconnectClient } from "@sbtools/sdk";
import type { RouteHandler } from "./types.js";
import { loadSchema } from "./schema-loader.js";
import { TEMPLATES } from "./templates.js";
import { scanMigrationFiles, readArtifactOrNull, writeArtifact } from "@sbtools/sdk";
import { runIntrospect } from "./tools/introspect.js";
import { runSqlParse } from "./tools/sql-parse.js";
import { runAddColumn } from "./tools/generate-add-column.js";
import { runAddFunction } from "./tools/generate-add-function.js";
import { runCreateRpc } from "./tools/generate-create-rpc.js";
import { runCreateTable } from "./tools/generate-create-table.js";
import { runAddRlsPolicy } from "./tools/generate-add-rls-policy.js";
import { runAddIndex } from "./tools/generate-add-index.js";
import { runAddConstraint } from "./tools/generate-add-constraint.js";
import { runRlsCheck } from "./tools/rls-check.js";
import { runMigrationLint } from "./tools/migration-lint.js";
import { runRpcLint } from "./tools/rpc-lint.js";
import { runMigrationPlan } from "./tools/migration-plan.js";
import { runReleaseGate } from "./tools/release-gate.js";
import { runGreenfieldInit } from "./tools/greenfield-init.js";
import { runCreateView } from "./tools/generate-create-view.js";
import { runIntentPatch } from "./tools/intent-patch.js";
import { runEndpointMap } from "./tools/endpoint-map.js";
import { startWorkflow, resumeWorkflow, loadWorkflowRun } from "./engine/runner.js";
import { adoptBackendSteps, adoptBackendRegistry, ADOPT_BACKEND_WORKFLOW_ID } from "./workflows/adopt-backend.js";
import { STUDIO_ARTIFACTS } from "./artifacts/constants.js";

const WATCH_STAMP_PATH_REL = path.join("watch", "last-event.json");
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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
    ? description
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_-]/g, "")
    : "migration";
  return `${ts}_${suffix || "migration"}.sql`;
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body;
}

const handleIndex: RouteHandler = async (_req, res) => {
  // Server-only mode: UI is hosted by @sbtools/ui-web dashboard.
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ service: "migration-studio", mode: "server-only", ui: "Open /migration-studio in ui-web dashboard" }));
};

const handleAnalyze: RouteHandler = async (req, res, ctx) => {
  const body = await readBody(req);
  try {
    const { sql } = JSON.parse(body);
    const analysis = analyzeMigrationSql(sql || "");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(analysis));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
};

/** Parse PostgreSQL error for line number. Format: "ERROR: ...\nLINE N: ..." or "ERROR: ... (line N)" */
function parsePgErrorLine(err: string): number | undefined {
  const lineMatch = err.match(/(?:^|\n)LINE\s+(\d+)[:\s]|\(line\s+(\d+)\)/i);
  return lineMatch ? parseInt(lineMatch[1] ?? lineMatch[2] ?? "0", 10) : undefined;
}

/** Same SQL formatting as migrate command, so dry run matches apply. */
function prepareMigrationSql(sql: string): string {
  const alreadyWrapped = /^\s*BEGIN\s*;/i.test(sql.trimStart());
  if (alreadyWrapped) return sql;
  const trimmed = sql.trimEnd();
  const needsSemicolon = trimmed.length > 0 && !trimmed.endsWith(";");
  return `BEGIN;\n${sql}${needsSemicolon ? ";" : ""}\nCOMMIT;`;
}

async function validateSql(sql: string): Promise<{ valid: boolean; error?: string; line?: number; dbConnected: boolean }> {
  if (!sql?.trim()) return { valid: true, dbConnected: false };
  if (sql.length > 50_000) return { valid: true, dbConnected: false }; // Skip validation for very large SQL
  const client = createPgClient();
  try {
    const ok = await testConnection(client);
    if (!ok) return { valid: true, dbConnected: false }; // Cannot validate without DB; don't block
    const toRun = prepareMigrationSql(sql);
    await client.query(toRun.replace("COMMIT;", "ROLLBACK;"));
    await disconnectClient(client);
    return { valid: true, dbConnected: true };
  } catch (e) {
    try {
      await client.query("ROLLBACK").catch((err) => {
        if (process.env.SBT_DEBUG === "1") console.warn("ROLLBACK failed:", (err as Error).message);
      });
    } catch {
      // ignore
    }
    try {
      await disconnectClient(client);
    } catch (err) {
      if (process.env.SBT_DEBUG === "1") console.warn("disconnectClient failed:", (err as Error).message);
    }
    const msg = (e as { message?: string }).message ?? String(e);
    if (msg.includes("connect") || msg.includes("ECONNREFUSED") || msg.includes("timeout")) {
      return { valid: true, dbConnected: false }; // DB unreachable; don't block
    }
    const line = parsePgErrorLine(msg);
    return { valid: false, error: msg, line, dbConnected: true };
  }
}

const handleValidate: RouteHandler = async (req, res, ctx) => {
  const body = await readBody(req);
  try {
    const { sql } = JSON.parse(body);
    const result = await validateSql(sql || "");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ valid: false, error: (e as Error).message }));
  }
};

function getMigrationStatus(ctx: PluginContext): Map<string, string> {
  const artifact = readArtifactOrNull(ctx, "migration.analysis", "1.0.0");
  const byStatus = new Map<string, string>();
  if (artifact?.data) {
    const data = artifact.data as { migrations?: { filename: string; status: string }[] };
    for (const m of data.migrations || []) byStatus.set(m.filename, m.status);
  }
  return byStatus;
}

const handleSave: RouteHandler = async (req, res, ctx) => {
  const body = await readBody(req);
  try {
    const { sql, description, filename: overwriteFilename } = JSON.parse(body);
    if (!(typeof sql === "string" && sql.trim())) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "SQL is required" }));
      return;
    }
    const validation = await validateSql(sql);
    if (validation.valid === false && validation.dbConnected) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: validation.error ?? "Invalid SQL", line: validation.line }));
      return;
    }
    const migrationsDir = ctx.paths.migrations;
    if (!fs.existsSync(migrationsDir)) fs.mkdirSync(migrationsDir, { recursive: true });

    let filename: string;
    if (typeof overwriteFilename === "string" && overwriteFilename.trim()) {
      const name = overwriteFilename.trim();
      if (!name.endsWith(".sql") || name.includes("..") || name.includes("/") || name.includes("\\")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid filename for overwrite" }));
        return;
      }
      const filePath = path.join(migrationsDir, name);
      if (!fs.existsSync(filePath)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Migration file not found" }));
        return;
      }
      const status = getMigrationStatus(ctx).get(name) || "pending";
      if (status === "applied") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Cannot overwrite applied migration" }));
        return;
      }
      filename = name;
      fs.writeFileSync(filePath, sql.trimEnd() + "\n", "utf8");
    } else {
      filename = generateMigrationFilename(description);
      const filePath = path.join(migrationsDir, filename);
      fs.writeFileSync(filePath, sql.trimEnd() + "\n", "utf8");
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        filename,
        filePath: path.join(migrationsDir, filename),
      })
    );
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message }));
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

const handleSchema: RouteHandler = async (req, res, ctx) => {
  if (!schemaCache) schemaCache = await loadSchema(ctx);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(schemaCache));
};

const handleTemplates: RouteHandler = async (req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ templates: TEMPLATES }));
};

const handleHealth: RouteHandler = async (_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
};

const handleEvents: RouteHandler = async (_req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    ...CORS_HEADERS,
  });
  res.write(`data: ${JSON.stringify({ type: "connected", at: new Date().toISOString() })}\n\n`);
  sseClients.add(res);
  res.on("close", () => {
    sseClients.delete(res);
  });
};

const handleMigrations: RouteHandler = async (req, res, ctx) => {
  const files = scanMigrationFiles(ctx.paths.migrations);
  const byStatus = getMigrationStatus(ctx);
  const list = files.map((f) => ({
    filename: f.filename,
    status: byStatus.get(f.filename) || "pending",
    sizeBytes: f.sizeBytes,
  }));
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ migrations: list }));
};

const handleMigrationFile: RouteHandler = async (req, res, ctx) => {
  const url = req.url ?? "";
  const match = url.match(/\/api\/migration\/([^/?#]+)/);
  const filename = match ? decodeURIComponent(match[1]) : "";
  if (!filename || filename.includes("..") || !filename.endsWith(".sql")) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid filename" }));
    return;
  }
  const filePath = path.join(ctx.paths.migrations, filename);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }
  const sql = fs.readFileSync(filePath, "utf8");
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ filename, sql }));
};

/** Compute the same hash as migration-plan uses for staleness detection. */
function computeSnapshotHash(snapshot: { entities?: Array<{ id: string; columns?: Array<{ name: string }> }>; policies?: Array<{ id: string }> }): string {
  const payload = JSON.stringify({
    entities: (snapshot.entities ?? []).map((e) => ({ id: e.id, columns: (e.columns ?? []).map((c) => c.name) })),
    policies: (snapshot.policies ?? []).map((p) => p.id),
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

const handleApply: RouteHandler = async (req, res, ctx) => {
  // Gate check: if studio.release.gate artifact exists and status is 'fail', block the apply.
  // If no gate artifact exists, allow but include a warning in the response.
  const gateEnv = readArtifactOrNull<{ status: string; blocking: Array<{ code: string; message: string }> }>(
    ctx,
    STUDIO_ARTIFACTS.RELEASE_GATE.id,
    STUDIO_ARTIFACTS.RELEASE_GATE.version
  );

  if (gateEnv?.data.status === "fail") {
    const blocking = gateEnv.data.blocking ?? [];
    res.writeHead(422, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: false,
        gateBlocked: true,
        error: `Release gate failed — ${blocking.length} blocking issue(s). Run studio-release-gate to review.`,
        blocking,
      })
    );
    return;
  }

  const gateWarning = gateEnv == null
    ? "No release gate artifact found. Run studio-release-gate before applying to production."
    : undefined;

  // Snapshot staleness check: if a migration plan exists, verify snapshot hasn't changed.
  let snapshotStale = false;
  const planEnv = readArtifactOrNull<{ snapshotHash?: string }>(
    ctx,
    STUDIO_ARTIFACTS.MIGRATION_PLAN.id,
    STUDIO_ARTIFACTS.MIGRATION_PLAN.version
  );
  if (planEnv?.data?.snapshotHash) {
    const snapshotEnv = readArtifactOrNull<{ entities?: unknown[]; policies?: unknown[] }>(
      ctx,
      STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id,
      STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.version
    );
    if (snapshotEnv?.data) {
      const currentHash = computeSnapshotHash(snapshotEnv.data as Parameters<typeof computeSnapshotHash>[0]);
      snapshotStale = currentHash !== planEnv.data.snapshotHash;
    }
  }

  try {
    const cliPath = path.join(ctx.toolsDir, "dist", "cli.js");
    const output = execSync(`node "${cliPath}" migrate`, {
      cwd: ctx.projectRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });

    // Write apply audit log artifact.
    writeArtifact(ctx, {
      id: STUDIO_ARTIFACTS.APPLY_LOG.id,
      version: STUDIO_ARTIFACTS.APPLY_LOG.version,
      producer: "apply",
      generatedAt: new Date().toISOString(),
      data: {
        appliedAt: new Date().toISOString(),
        output: String(output).slice(0, 2000),
        success: true,
      },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, output, gateWarning, snapshotStale: snapshotStale || undefined }));
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string };
    const msg = err.stderr || err.stdout || (e as Error).message;
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: String(msg).slice(-500) }));
  }
};

// ---------------------------------------------------------------------------
// Studio adoption / introspection routes
// ---------------------------------------------------------------------------

const handleStudioIntrospect: RouteHandler = async (_req, res, ctx) => {
  try {
    await runIntrospect(ctx);
    const env = readArtifactOrNull(ctx, STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id, STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.version);
    const data = env?.data as { entities?: unknown[]; policies?: unknown[]; infrastructure?: unknown[] } | undefined;
    const entities = data?.entities?.length ?? 0;
    const policies = data?.policies?.length ?? 0;
    const infrastructure = data?.infrastructure?.length ?? 0;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ entities, policies, infrastructure }));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
};

const handleStudioSqlParse: RouteHandler = async (_req, res, ctx) => {
  try {
    await runSqlParse(ctx);
    const env = readArtifactOrNull(ctx, STUDIO_ARTIFACTS.SQL_AST.id, STUDIO_ARTIFACTS.SQL_AST.version);
    const data = env?.data as { files?: unknown[]; totalStatements?: number; totalOpaqueBlocks?: number } | undefined;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        files: data?.files?.length ?? 0,
        totalStatements: data?.totalStatements ?? 0,
        totalOpaqueBlocks: data?.totalOpaqueBlocks ?? 0,
      })
    );
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
};

const handleStudioIntentGraph: RouteHandler = async (_req, res, ctx) => {
  const env = readArtifactOrNull(ctx, STUDIO_ARTIFACTS.INTENT_GRAPH.id, STUDIO_ARTIFACTS.INTENT_GRAPH.version);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(env?.data ?? null));
};

const handleStudioAdoptStatus: RouteHandler = async (_req, res, ctx) => {
  const run = loadWorkflowRun(ctx);
  if (!run) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "not_started" }));
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(run));
};

const handleStudioAdoptStart: RouteHandler = async (_req, res, ctx) => {
  try {
    const run = await startWorkflow(ADOPT_BACKEND_WORKFLOW_ID, adoptBackendSteps, ctx, adoptBackendRegistry);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(run));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
};

const handleStudioAdoptResume: RouteHandler = async (_req, res, ctx) => {
  try {
    const run = loadWorkflowRun(ctx);
    if (!run || run.status !== "waiting_checkpoint") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "No workflow run in waiting_checkpoint state" }));
      return;
    }
    const updated = await resumeWorkflow(run, adoptBackendSteps, ctx, adoptBackendRegistry);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(updated));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
};

// ---------------------------------------------------------------------------
// Studio scaffold routes
// ---------------------------------------------------------------------------

const handleAddColumn: RouteHandler = async (req, res, ctx) => {
  const body = await readBody(req);
  try {
    const { entityId, column } = JSON.parse(body);
    if (!entityId || !column?.name || !column?.type) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "entityId and column { name, type } required" }));
      return;
    }
    const result = await runAddColumn(ctx, {
      entityId: String(entityId),
      column: {
        name: String(column.name),
        type: String(column.type),
        nullable: Boolean(column.nullable !== false),
        default: column.default != null ? String(column.default) : undefined,
      },
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    const err = e as { code?: string };
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message, code: err.code }));
  }
};

const handleAddFunction: RouteHandler = async (req, res, ctx) => {
  const body = await readBody(req);
  try {
    const input = JSON.parse(body);
    if (!input?.name || !input?.returnType || !input?.body) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "name, returnType, and body required" }));
      return;
    }
    const result = await runAddFunction(ctx, {
      schema: input.schema ?? "public",
      name: String(input.name),
      params: Array.isArray(input.params) ? input.params : [],
      returnType: String(input.returnType),
      language: input.language === "sql" ? "sql" : "plpgsql",
      body: String(input.body),
      security: input.security === "definer" ? "definer" : "invoker",
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
};

const handleCreateRpc: RouteHandler = async (req, res, ctx) => {
  const body = await readBody(req);
  try {
    const input = JSON.parse(body);
    if (!input?.name || !input?.returnType || !input?.body) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "name, returnType, and body required" }));
      return;
    }
    const result = await runCreateRpc(ctx, {
      name: String(input.name),
      params: Array.isArray(input.params) ? input.params : [],
      returnType: String(input.returnType),
      language: input.language === "sql" ? "sql" : "plpgsql",
      body: String(input.body),
      security: input.security === "definer" ? "definer" : "invoker",
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
};

const handleCreateTable: RouteHandler = async (req, res, ctx) => {
  const body = await readBody(req);
  try {
    const input = JSON.parse(body);
    if (!input?.name || !Array.isArray(input?.columns)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "name and columns[] are required" }));
      return;
    }
    const result = await runCreateTable(ctx, {
      schema: input.schema ?? "public",
      name: String(input.name),
      columns: input.columns,
      primaryKey: Array.isArray(input.primaryKey) ? input.primaryKey : undefined,
      enableRls: input.enableRls !== false,
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
};

const handleAddRlsPolicy: RouteHandler = async (req, res, ctx) => {
  const body = await readBody(req);
  try {
    const input = JSON.parse(body);
    if (!input?.entityId || !input?.policy?.name || !input?.policy?.command || !Array.isArray(input?.policy?.roles)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "entityId and policy { name, command, roles } are required" }));
      return;
    }
    const result = await runAddRlsPolicy(ctx, {
      entityId: String(input.entityId),
      policy: {
        name: String(input.policy.name),
        command: input.policy.command,
        roles: input.policy.roles.map(String),
        using: input.policy.using != null ? String(input.policy.using) : undefined,
        withCheck: input.policy.withCheck != null ? String(input.policy.withCheck) : undefined,
        permissive: input.policy.permissive !== false,
      },
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
};

const handleAddIndex: RouteHandler = async (req, res, ctx) => {
  const body = await readBody(req);
  try {
    const input = JSON.parse(body);
    if (!input?.entityId || !Array.isArray(input?.index?.columns)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "entityId and index.columns[] are required" }));
      return;
    }
    const result = await runAddIndex(ctx, {
      entityId: String(input.entityId),
      index: {
        name: input.index.name != null ? String(input.index.name) : undefined,
        columns: input.index.columns.map(String),
        unique: Boolean(input.index.unique),
        method: input.index.method ?? "btree",
        where: input.index.where != null ? String(input.index.where) : undefined,
      },
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
};

const handleAddConstraint: RouteHandler = async (req, res, ctx) => {
  const body = await readBody(req);
  try {
    const input = JSON.parse(body);
    if (!input?.entityId || !input?.constraint?.name || !input?.constraint?.type) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "entityId and constraint { name, type } are required" }));
      return;
    }
    const result = await runAddConstraint(ctx, {
      entityId: String(input.entityId),
      constraint: input.constraint,
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
};

const handleCreateView: RouteHandler = async (req, res, ctx) => {
  const body = await readBody(req);
  try {
    const input = JSON.parse(body);
    if (!input?.name || !input?.query) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "name and query are required" }));
      return;
    }
    const result = await runCreateView(ctx, {
      schema: input.schema ?? "public",
      name: String(input.name),
      query: String(input.query),
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
};

// ---------------------------------------------------------------------------
// Studio greenfield route
// ---------------------------------------------------------------------------

const handleGreenfieldInit: RouteHandler = async (_req, res, ctx) => {
  try {
    const graph = await runGreenfieldInit(ctx);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ mode: graph.mode, entities: graph.entities.length }));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
};

const handleIntentPatch: RouteHandler = async (req, res, ctx) => {
  const body = await readBody(req);
  try {
    const input = JSON.parse(body);
    if (!input?.entityId || !input?.action) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "entityId and action are required" }));
      return;
    }
    const result = await runIntentPatch(ctx, {
      entityId: String(input.entityId),
      action: input.action as "exclude" | "set-status",
      status: input.status,
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    const err = e as { code?: string };
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message, code: err.code }));
  }
};

const handleEndpointMap: RouteHandler = async (_req, res, ctx) => {
  try {
    const result = await runEndpointMap(ctx);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    const err = e as { code?: string };
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message, code: err.code }));
  }
};

// ---------------------------------------------------------------------------
// Studio validation routes
// ---------------------------------------------------------------------------

const handleRlsCheck: RouteHandler = async (_req, res, ctx) => {
  try {
    const { report, plan } = await runRlsCheck(ctx);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ report, plan }));
  } catch (e) {
    const err = e as { code?: string };
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message, code: err.code }));
  }
};

const handleMigrationLint: RouteHandler = async (_req, res, ctx) => {
  try {
    const result = await runMigrationLint(ctx);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    const err = e as { code?: string };
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message, code: err.code }));
  }
};

const handleRpcLint: RouteHandler = async (_req, res, ctx) => {
  try {
    const result = await runRpcLint(ctx);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    const err = e as { code?: string };
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message, code: err.code }));
  }
};

const handleMigrationPlan: RouteHandler = async (_req, res, ctx) => {
  try {
    const result = await runMigrationPlan(ctx);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    const err = e as { code?: string };
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message, code: err.code }));
  }
};

const handleReleaseGate: RouteHandler = async (_req, res, ctx) => {
  try {
    const result = await runReleaseGate(ctx);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
};

function initStudioFsBridge(ctx: PluginContext): void {
  if (fsBridgeStarted) return;
  fsBridgeStarted = true;

  const watchStampPath = path.join(ctx.sbtDataDir, WATCH_STAMP_PATH_REL);
  const watchStampDir = path.dirname(watchStampPath);
  const artifactPath = path.join(ctx.sbtDataDir, "artifacts", "migration.analysis", "1.0.0", "latest.json");
  const artifactDir = path.dirname(artifactPath);

  fs.mkdirSync(watchStampDir, { recursive: true });
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.mkdirSync(ctx.paths.migrations, { recursive: true });

  const watchDir = (dir: string, onChange: (filename: string) => void) => {
    const watcher = fs.watch(dir, (_eventType, filename) => onChange(filename?.toString() ?? ""));
    fsBridgeWatchers.push(watcher);
  };

  watchDir(path.dirname(watchStampPath), (filename) => {
    if (filename !== path.basename(watchStampPath)) return;
    invalidateStudioCaches("watch_event");
  });

  watchDir(path.dirname(artifactPath), (filename) => {
    if (filename !== path.basename(artifactPath)) return;
    invalidateStudioCaches("artifact_changed");
  });

  watchDir(ctx.paths.migrations, (filename) => {
    if (!filename.endsWith(".sql")) return;
    invalidateStudioCaches("migration_file_changed");
  });

  process.once("exit", () => {
    for (const w of fsBridgeWatchers) w.close();
  });
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
    // Studio adoption / introspection
    ["POST:/api/studio/introspect", handleStudioIntrospect],
    ["POST:/api/studio/sql-parse", handleStudioSqlParse],
    ["GET:/api/studio/intent-graph", handleStudioIntentGraph],
    ["GET:/api/studio/adopt/status", handleStudioAdoptStatus],
    ["POST:/api/studio/adopt/start", handleStudioAdoptStart],
    ["POST:/api/studio/adopt/resume", handleStudioAdoptResume],
    // Studio scaffold
    ["POST:/api/studio/scaffold/add-column", handleAddColumn],
    ["POST:/api/studio/scaffold/add-function", handleAddFunction],
    ["POST:/api/studio/scaffold/create-rpc", handleCreateRpc],
    ["POST:/api/studio/scaffold/create-table", handleCreateTable],
    ["POST:/api/studio/scaffold/add-rls-policy", handleAddRlsPolicy],
    ["POST:/api/studio/scaffold/add-index", handleAddIndex],
    ["POST:/api/studio/scaffold/add-constraint", handleAddConstraint],
    ["POST:/api/studio/scaffold/create-view", handleCreateView],
    // Studio greenfield
    ["POST:/api/studio/greenfield-init", handleGreenfieldInit],
    // Studio intent mutation + endpoint mapping
    ["POST:/api/studio/intent-graph/entity", handleIntentPatch],
    ["POST:/api/studio/endpoint-map", handleEndpointMap],
    // Studio validation
    ["POST:/api/studio/rls-check", handleRlsCheck],
    ["POST:/api/studio/migration-lint", handleMigrationLint],
    ["POST:/api/studio/rpc-lint", handleRpcLint],
    ["POST:/api/studio/migration-plan", handleMigrationPlan],
    ["POST:/api/studio/release-gate", handleReleaseGate],
  ]);

  return async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }
    const url = req.url ?? "/";
    const pathname = url.split("?")[0];
    const method = req.method ?? "GET";
    let handler = routes.get(`${method}:${pathname}`);
    if (!handler && method === "GET" && pathname.startsWith("/api/migration/") && pathname !== "/api/migration/") {
      handler = handleMigrationFile;
    }
    if (typeof handler === "function") {
      for (const [key, value] of Object.entries(CORS_HEADERS)) {
        res.setHeader(key, value);
      }
      await handler(req, res, ctx);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  };
}
