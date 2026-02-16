/**
 * HTTP server and route handlers for Migration Studio.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import type { PluginContext } from "@sbtools/sdk";
import { analyzeMigrationSql, createPgClient, testConnection, disconnectClient } from "@sbtools/sdk";
import type { RouteHandler } from "./types.js";
import { generateEditorPage } from "./html/editor-page.js";
import { loadSchema } from "./schema-loader.js";
import { TEMPLATES } from "./templates.js";
import { scanMigrationFiles } from "@sbtools/sdk";
import { readArtifactOrNull } from "@sbtools/sdk";

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

const handleIndex: RouteHandler = async (req, res, ctx) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(generateEditorPage(ctx));
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
      await client.query("ROLLBACK").catch(() => {});
    } catch {
      // ignore
    }
    try {
      await disconnectClient(client);
    } catch {
      // ignore
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

const handleSchema: RouteHandler = async (req, res, ctx) => {
  if (!schemaCache) schemaCache = await loadSchema(ctx);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(schemaCache));
};

const handleTemplates: RouteHandler = async (req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ templates: TEMPLATES }));
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

const handleApply: RouteHandler = async (req, res, ctx) => {
  try {
    const cliPath = path.join(ctx.toolsDir, "dist", "cli.js");
    const output = execSync(`node "${cliPath}" migrate`, {
      cwd: ctx.projectRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, output }));
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string };
    const msg = err.stderr || err.stdout || (e as Error).message;
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: String(msg).slice(-500) }));
  }
};

const LIB_PREFIX = "/lib/";

function findNodeModulesRoot(): string {
  const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  for (let d = pluginDir; d !== path.dirname(d); d = path.dirname(d)) {
    const viewPath = path.join(d, "node_modules", "@codemirror", "view", "dist", "index.js");
    if (fs.existsSync(viewPath)) return path.join(d, "node_modules");
  }
  return path.join(pluginDir, "node_modules");
}

function serveLibFile(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const url = req.url ?? "/";
  const pathname = url.split("?")[0];
  if (pathname.startsWith(LIB_PREFIX) && req.method === "GET") {
    const subpath = pathname.slice(LIB_PREFIX.length);
    if (subpath.includes("..") || subpath.startsWith("/")) {
      res.writeHead(400);
      res.end("Bad request");
      return true;
    }
    const filePath = path.join(findNodeModulesRoot(), subpath);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return true;
    }
    const ext = path.extname(filePath);
    const mimes: Record<string, string> = { ".js": "application/javascript", ".mjs": "application/javascript", ".map": "application/json" };
    res.writeHead(200, { "Content-Type": mimes[ext] || "application/octet-stream" });
    res.end(fs.readFileSync(filePath));
    return true;
  }
  return false;
}

export function createRequestHandler(ctx: PluginContext): (req: http.IncomingMessage, res: http.ServerResponse) => void {
  const routes = new Map<string, RouteHandler>([
    ["GET:/", handleIndex],
    ["GET:/index.html", handleIndex],
    ["GET:/api/schema", handleSchema],
    ["GET:/api/templates", handleTemplates],
    ["GET:/api/migrations", handleMigrations],
    ["POST:/api/analyze", handleAnalyze],
    ["POST:/api/validate", handleValidate],
    ["POST:/api/save", handleSave],
    ["POST:/api/apply", handleApply],
  ]);

  return async (req, res) => {
    if (serveLibFile(req, res)) return;
    const url = req.url ?? "/";
    const pathname = url.split("?")[0];
    const method = req.method ?? "GET";
    let handler = routes.get(`${method}:${pathname}`);
    if (!handler && method === "GET" && pathname.startsWith("/api/migration/") && pathname !== "/api/migration/") {
      handler = handleMigrationFile;
    }
    if (typeof handler === "function") {
      await handler(req, res, ctx);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  };
}
