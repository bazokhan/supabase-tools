/**
 * dashboard command — Serve the React dashboard SPA with API routes.
 */
import { execSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveContainerPrefix, getArg, ui, withHelp } from "@sbtools/sdk";
import type { DashboardSectionDef, PluginContext } from "@sbtools/sdk";
import { allCommands } from "../command-registry.js";

const CORE_SECTIONS: DashboardSectionDef[] = [
  {
    id: "functions",
    title: "Functions",
    description: "Stored procedures with call recipes and execution hints.",
    dataKey: "functions",
    layout: "cards",
    card: {
      titleField: "name",
      subtitleField: "signature",
      searchFields: ["name", "schema", "signature"],
      badges: [{ field: "volatility" }],
      details: [
        { label: "Schema", field: "schema" },
        { label: "Returns", field: "returns", format: "code" },
      ],
    },
  },
  {
    id: "policies",
    title: "RLS Policies",
    description: "Row-level security rules by table and command.",
    dataKey: "policies",
    layout: "cards",
    card: {
      titleField: "name",
      subtitleField: "table",
      searchFields: ["name", "schema", "table"],
      badges: [{ field: "command" }],
      details: [
        { label: "Table", field: "table" },
        { label: "Roles", field: "roles" },
      ],
    },
  },
  {
    id: "triggers",
    title: "Triggers",
    description: "Automation hooks running inside the database.",
    dataKey: "triggers",
    layout: "cards",
    card: {
      titleField: "name",
      subtitleField: "table",
      searchFields: ["name", "schema", "table"],
      badges: [{ field: "timing" }],
      details: [
        { label: "Table", field: "table" },
        { label: "Function", field: "function_name" },
      ],
    },
  },
  {
    id: "views",
    title: "Views",
    description: "Projection layers for queries and secure access patterns.",
    dataKey: "views",
    layout: "cards",
    card: {
      titleField: "name",
      subtitleField: "schema",
      searchFields: ["name", "schema"],
      details: [{ label: "Schema", field: "schema" }],
    },
  },
  {
    id: "materialized_views",
    title: "Materialized Views",
    description: "Cached query results for analytics and aggregates.",
    dataKey: "materialized_views",
    layout: "cards",
    card: {
      titleField: "name",
      subtitleField: "schema",
      searchFields: ["name", "schema"],
      details: [{ label: "Schema", field: "schema" }],
    },
  },
  {
    id: "types",
    title: "Types",
    description: "Custom composite and domain types used in the schema.",
    dataKey: "types",
    layout: "cards",
    card: {
      titleField: "name",
      subtitleField: "schema",
      searchFields: ["name", "schema"],
      badges: [{ field: "type_kind" }],
      details: [{ label: "Schema", field: "schema" }],
    },
  },
  {
    id: "enums",
    title: "Enums",
    description: "Enumerated constants shared across the backend.",
    dataKey: "enums",
    layout: "cards",
    card: {
      titleField: "name",
      subtitleField: "schema",
      searchFields: ["name", "schema", "values"],
      details: [
        { label: "Schema", field: "schema" },
        { label: "Values", field: "values" },
      ],
    },
  },
];

const SERVICE_MAP: Record<string, string> = {
  functions: "supabase-functions",
  db: "supabase-db",
  rest: "supabase-rest",
  auth: "supabase-auth",
  kong: "supabase-kong",
  storage: "supabase-storage",
  realtime: "supabase-realtime",
  studio: "supabase-studio",
  meta: "supabase-meta",
  inbucket: "supabase-inbucket",
};

const DASHBOARD_HELP = `
dashboard — Start the development dashboard UI

Usage:
  sbt dashboard              Start on default port 3400
  sbt dashboard --port N     Use port N

The dashboard serves the React SPA and APIs for atlas data, dashboard config, services, live logs, and file browsing.
`;

const DEFAULT_PORT = 3400;

function resolveDashboardDir(): string {
  const distDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  return path.join(distDir, "dashboard");
}

function collectDashboardSections(ctx: PluginContext): DashboardSectionDef[] {
  const sections: DashboardSectionDef[] = [];
  for (const plugin of ctx.siblingPlugins ?? []) {
    if (typeof plugin.getDashboardView === "function") {
      try {
        const view = plugin.getDashboardView();
        if (view?.sections?.length) sections.push(...view.sections);
      } catch (err) {
        ui.warn(`Plugin ${plugin.name} getDashboardView failed: ${(err as Error).message}`);
      }
    }
  }
  return sections;
}

function detectLevel(line: string): "error" | "warn" | "info" {
  const lower = line.toLowerCase();
  if (lower.includes("error") || lower.includes("fatal") || lower.includes("panic")) return "error";
  if (lower.includes("warn")) return "warn";
  return "info";
}

function parseLogLine(service: string, raw: string): { service: string; level: string; timestamp: string; message: string } {
  const dockerTs = raw.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z?)\s*(.*)$/);
  if (dockerTs) {
    const dt = new Date(dockerTs[1]);
    const ts = Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(11, 19);
    const message = dockerTs[2] ?? "";
    return { service, level: detectLevel(message), timestamp: ts, message };
  }
  return { service, level: detectLevel(raw), timestamp: "", message: raw };
}

function getServiceStatuses(projectRoot: string): Array<{ service: string; container: string; running: boolean; status: string }> {
  const prefix = deriveContainerPrefix(projectRoot);
  return Object.entries(SERVICE_MAP).map(([service, suffix]) => {
    const container = `${prefix}-${suffix}`;
    try {
      const running =
        execSync(`docker inspect --format "{{.State.Running}}" "${container}"`, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        }).trim() === "true";
      const status =
        execSync(`docker inspect --format "{{.State.Status}}" "${container}"`, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        }).trim() || "unknown";
      return { service, container, running, status };
    } catch {
      return { service, container, running: false, status: "not found" };
    }
  });
}

function resolveScopeRoot(ctx: PluginContext, scope: string): string | null {
  switch (scope) {
    case "snapshot":
      return ctx.paths.snapshot;
    case "migrations":
      return ctx.paths.migrations;
    case "docs":
      return ctx.paths.docsOutput;
    case "project":
      return ctx.projectRoot;
    default:
      return null;
  }
}

function resolveSafePath(root: string, relativePath: string): string | null {
  const cleaned = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (cleaned.includes("..")) return null;
  const rootAbs = path.resolve(root);
  const fileAbs = path.resolve(rootAbs, cleaned);
  if (!fileAbs.startsWith(rootAbs)) return null;
  return fileAbs;
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function handleLogStream(req: http.IncomingMessage, res: http.ServerResponse, ctx: PluginContext, rawUrl: string): void {
  const parsed = new URL(rawUrl, "http://localhost");
  const prefix = deriveContainerPrefix(ctx.projectRoot);
  const requested = (parsed.searchParams.get("services") ?? "").split(",").filter(Boolean);
  const services = requested.length > 0 ? requested : Object.keys(SERVICE_MAP);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const children: ChildProcess[] = [];
  const ping = setInterval(() => res.write(": ping\n\n"), 20000);

  for (const service of services) {
    const suffix = SERVICE_MAP[service];
    if (!suffix) continue;

    const container = `${prefix}-${suffix}`;
    const child = spawn("docker", ["logs", "-f", "--tail", "100", "--timestamps", container], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(child);

    const handleData = (stream?: NodeJS.ReadableStream | null) => {
      if (!stream) return;
      let buffer = "";
      stream.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const parsedLine = parseLogLine(service, line);
          res.write(`data: ${JSON.stringify(parsedLine)}\n\n`);
        }
      });
    };

    handleData(child.stdout);
    handleData(child.stderr);

    child.on("error", () => {
      res.write(`data: ${JSON.stringify({ service, level: "error", timestamp: "", message: `Failed to read ${container}` })}\n\n`);
    });
  }

  req.on("close", () => {
    clearInterval(ping);
    for (const child of children) {
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore
      }
    }
  });
}

function resolveErdDir(ctx: PluginContext): string {
  try {
    const configPath = path.join(ctx.projectRoot, "supabase-tools.config.json");
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
        plugins?: Array<{ path: string; config?: Record<string, unknown> }>;
      };
      const erdEntry = cfg.plugins?.find((p) => String(p.path).includes("plugin-erd"));
      const erdOutput = erdEntry?.config?.erdOutput;
      if (typeof erdOutput === "string") {
        return path.isAbsolute(erdOutput)
          ? erdOutput
          : path.resolve(ctx.projectRoot, erdOutput);
      }
    }
  } catch {
    // fall through to default
  }
  return path.join(ctx.paths.docsOutput, "entity-relations");
}

const BLOCKED_COMMANDS = new Set(["dashboard", "docs", "init"]);

function findSbtBin(projectRoot: string): string {
  const ext = process.platform === "win32" ? ".cmd" : "";
  const local = path.join(projectRoot, `node_modules/.bin/sbt${ext}`);
  if (fs.existsSync(local)) return local;
  return "sbt";
}

function collectCommands(ctx: PluginContext): Array<{ name: string; description: string; category: string; source: string }> {
  const commands: Array<{ name: string; description: string; category: string; source: string }> = [];
  for (const cmd of allCommands()) {
    commands.push({ name: cmd.name, description: cmd.description, category: cmd.category, source: "core" });
  }
  for (const plugin of ctx.siblingPlugins ?? []) {
    for (const cmd of plugin.commands ?? []) {
      commands.push({ name: cmd.name, description: cmd.description, category: plugin.name, source: plugin.name });
    }
  }
  return commands;
}

function createRequestHandler(ctx: PluginContext, dashboardDir: string) {
  const atlasDataPath = path.join(ctx.paths.docsOutput, "backend-atlas-data.json");

  return (req: http.IncomingMessage, res: http.ServerResponse): void => {
    const url = req.url ?? "/";
    const [pathname] = url.split("?");

    if (pathname === "/api/atlas-data") {
      if (!fs.existsSync(atlasDataPath)) {
        sendJson(res, 404, { error: "backend-atlas-data.json not found. Run sbt generate-atlas." });
        return;
      }
      const data = JSON.parse(fs.readFileSync(atlasDataPath, "utf8")) as {
        meta?: unknown;
        schemas?: string[];
        categories?: Record<string, unknown[]>;
      };
      // Runtime fallback: if erd_diagrams missing/empty, read from entity-relations on disk
      const erdDir = resolveErdDir(ctx);
      const hasErdInAtlas = Array.isArray(data.categories?.erd_diagrams) && data.categories.erd_diagrams.length > 0;
      if (!hasErdInAtlas && fs.existsSync(erdDir) && fs.statSync(erdDir).isDirectory()) {
        const files = fs.readdirSync(erdDir).filter((f) => f.endsWith(".md"));
        const diagrams = files.map((f) => {
          const content = fs.readFileSync(path.join(erdDir, f), "utf8");
          const tableName = f.replace(/\.md$/, "");
          const mermaidMatch = content.match(/```mermaid\n([\s\S]*?)```/);
          const mermaid = mermaidMatch?.[1]?.trim() ?? "";
          return { table: tableName, mermaid, markdown: content };
        });
        if (diagrams.length > 0) {
          if (!data.categories) data.categories = {};
          data.categories.erd_diagrams = diagrams;
        }
      }
      sendJson(res, 200, data);
      return;
    }

    if (pathname === "/api/dashboard-config") {
      const pluginSections = collectDashboardSections(ctx);
      sendJson(res, 200, { sections: [...CORE_SECTIONS, ...pluginSections] });
      return;
    }

    if (pathname === "/api/services" || pathname === "/api/logs/services") {
      sendJson(res, 200, getServiceStatuses(ctx.projectRoot));
      return;
    }

    if (pathname === "/api/logs/stream") {
      handleLogStream(req, res, ctx, url);
      return;
    }

    if (pathname === "/api/fs/list") {
      const parsed = new URL(url, "http://localhost");
      const scope = parsed.searchParams.get("scope") ?? "";
      const relPath = parsed.searchParams.get("path") ?? "";
      const root = resolveScopeRoot(ctx, scope);
      if (!root) {
        sendJson(res, 400, { error: "Invalid scope. Use snapshot|migrations|docs|project." });
        return;
      }

      const diskPath = resolveSafePath(root, relPath);
      if (!diskPath || !fs.existsSync(diskPath)) {
        sendJson(res, 404, { error: "Path not found." });
        return;
      }

      if (fs.statSync(diskPath).isFile()) {
        sendJson(res, 200, {
          scope,
          path: relPath,
          type: "file",
          href: `/api/fs/file?scope=${encodeURIComponent(scope)}&path=${encodeURIComponent(relPath)}`,
        });
        return;
      }

      const entries = fs.readdirSync(diskPath, { withFileTypes: true })
        .map((entry) => {
          const childRel = relPath ? `${relPath.replace(/\\/g, "/").replace(/\/$/, "")}/${entry.name}` : entry.name;
          const childAbs = resolveSafePath(root, childRel);
          const size = childAbs && fs.existsSync(childAbs) && fs.statSync(childAbs).isFile() ? fs.statSync(childAbs).size : 0;
          return {
            name: entry.name,
            path: childRel,
            type: entry.isDirectory() ? "dir" : "file",
            size,
            href: entry.isDirectory()
              ? `/api/fs/list?scope=${encodeURIComponent(scope)}&path=${encodeURIComponent(childRel)}`
              : `/api/fs/file?scope=${encodeURIComponent(scope)}&path=${encodeURIComponent(childRel)}`,
          };
        })
        .slice(0, 500);

      sendJson(res, 200, { scope, path: relPath, root, type: "dir", entries });
      return;
    }

    if (pathname === "/api/fs/file") {
      const parsed = new URL(url, "http://localhost");
      const scope = parsed.searchParams.get("scope") ?? "";
      const relPath = parsed.searchParams.get("path") ?? "";
      const root = resolveScopeRoot(ctx, scope);
      if (!root) {
        sendJson(res, 400, { error: "Invalid scope. Use snapshot|migrations|docs|project." });
        return;
      }

      const diskPath = resolveSafePath(root, relPath);
      if (!diskPath || !fs.existsSync(diskPath) || !fs.statSync(diskPath).isFile()) {
        sendJson(res, 404, { error: "File not found." });
        return;
      }

      const ext = path.extname(diskPath).toLowerCase();
      const mime: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".ts": "text/plain; charset=utf-8",
        ".tsx": "text/plain; charset=utf-8",
        ".sql": "text/plain; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".md": "text/plain; charset=utf-8",
        ".css": "text/css; charset=utf-8",
      };
      const contentType = mime[ext] ?? "text/plain; charset=utf-8";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(fs.readFileSync(diskPath));
      return;
    }

    if (pathname === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("data: {\"type\":\"init\"}\n\n");
      const interval = setInterval(() => res.write(": ping\n\n"), 30000);
      req.on("close", () => clearInterval(interval));
      return;
    }

    if (pathname === "/api/commands") {
      sendJson(res, 200, { commands: collectCommands(ctx) });
      return;
    }

    if (pathname === "/api/run/stream") {
      const parsed = new URL(url, "http://localhost");
      const command = parsed.searchParams.get("command") ?? "";
      const knownCommands = new Set(collectCommands(ctx).map((c) => c.name));

      if (!command || BLOCKED_COMMANDS.has(command) || !knownCommands.has(command)) {
        sendJson(res, 400, { error: `Command '${command}' cannot be invoked from the dashboard.` });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const bin = findSbtBin(ctx.projectRoot);
      const child = spawn(bin, [command], {
        cwd: ctx.projectRoot,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      });

      res.write(`data: ${JSON.stringify({ type: "start", command, pid: child.pid })}\n\n`);

      const pipeStream = (stream: NodeJS.ReadableStream | null, streamType: "stdout" | "stderr") => {
        if (!stream) return;
        let buffer = "";
        stream.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            res.write(`data: ${JSON.stringify({ type: streamType, line })}\n\n`);
          }
        });
        stream.on("end", () => {
          if (buffer) {
            res.write(`data: ${JSON.stringify({ type: streamType, line: buffer })}\n\n`);
            buffer = "";
          }
        });
      };

      pipeStream(child.stdout, "stdout");
      pipeStream(child.stderr, "stderr");

      child.on("close", (code) => {
        res.write(`data: ${JSON.stringify({ type: "exit", code: code ?? 1, success: code === 0 })}\n\n`);
        res.end();
      });

      child.on("error", (err) => {
        res.write(`data: ${JSON.stringify({ type: "stderr", line: `Failed to start process: ${(err as Error).message}` })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "exit", code: 1, success: false })}\n\n`);
        res.end();
      });

      req.on("close", () => {
        try { child.kill("SIGTERM"); } catch { /* ignore */ }
      });
      return;
    }

    if (pathname === "/dependency-graph.html" || pathname === "/migration-audit.html") {
      const docsPath = path.join(ctx.paths.docsOutput, pathname.replace(/^\//, ""));
      if (fs.existsSync(docsPath) && fs.statSync(docsPath).isFile()) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fs.readFileSync(docsPath, "utf8"));
        return;
      }
    }

    const filePath = pathname === "/" ? "/index.html" : pathname;
    const diskPath = path.join(dashboardDir, filePath.replace(/^\//, "").replace(/\.\./g, ""));

    if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
      const ext = path.extname(diskPath);
      const mime: Record<string, string> = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".ico": "image/x-icon",
      };
      res.writeHead(200, { "Content-Type": mime[ext] ?? "application/octet-stream" });
      res.end(fs.readFileSync(diskPath));
      return;
    }

    const indexPath = path.join(dashboardDir, "index.html");
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(fs.readFileSync(indexPath, "utf8"));
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  };
}

async function runDashboard(args: string[], ctx: PluginContext): Promise<void> {
  const port = parseInt(getArg(args, "--port") ?? String(DEFAULT_PORT), 10) || DEFAULT_PORT;
  const dashboardDir = resolveDashboardDir();

  if (!fs.existsSync(dashboardDir)) {
    ui.error("Dashboard not found. Reinstall @sbtools/core or build from source.\n");
    process.exit(1);
  }

  const handler = createRequestHandler(ctx, dashboardDir);
  const server = http.createServer(handler);

  await new Promise<void>((resolve, reject) => {
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        ui.error(`Port ${port} is already in use. Stop the other process or use --port N.\n`);
        resolve();
      } else {
        reject(err);
      }
    });

    server.listen(port, () => {
      ui.success(`Dashboard at http://localhost:${port}`);
      ui.detail("Press Ctrl+C to stop.");
    });

    const shutdown = () => {
      ui.info("\nShutting down dashboard...");
      server.close(() => resolve());
      setTimeout(() => resolve(), 2000).unref();
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
}

export const dashboardCommand = withHelp(DASHBOARD_HELP, runDashboard);
