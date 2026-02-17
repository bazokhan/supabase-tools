/**
 * dashboard command — Serve the React dashboard SPA with API routes.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ui, getArg, withHelp } from "@sbtools/sdk";
import type { PluginContext } from "@sbtools/sdk";
import type { DashboardSectionDef } from "@sbtools/sdk";

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


const DASHBOARD_HELP = `
dashboard — Start the development dashboard UI

Usage:
  sbt dashboard              Start on default port 3400
  sbt dashboard --port N     Use port N

The dashboard serves the React SPA and APIs for atlas data, dashboard config, and services.
`;

const DEFAULT_PORT = 3400;

function resolveDashboardDir(): string {
  // Dashboard is copied into core/dist/dashboard during core's build.
  // From dist/commands/dashboard.js we go up to dist/, then to dashboard/.
  const distDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  return path.join(distDir, "dashboard");
}

function collectDashboardSections(ctx: PluginContext): DashboardSectionDef[] {
  const sections: DashboardSectionDef[] = [];
  for (const p of ctx.siblingPlugins ?? []) {
    if (typeof p.getDashboardView === "function") {
      try {
        const view = p.getDashboardView();
        if (view?.sections?.length) {
          sections.push(...view.sections);
        }
      } catch (err) {
        ui.warn(`Plugin ${p.name} getDashboardView failed: ${(err as Error).message}`);
      }
    }
  }
  return sections;
}

function createRequestHandler(ctx: PluginContext, dashboardDir: string) {
  const atlasDataPath = path.join(ctx.paths.docsOutput, "backend-atlas-data.json");

  return (req: http.IncomingMessage, res: http.ServerResponse): void => {
    const url = req.url ?? "/";
    const [pathname, qs] = url.split("?");
    const searchParams = qs ? new URLSearchParams(qs) : new URLSearchParams();

    // API: atlas data
    if (pathname === "/api/atlas-data") {
      if (!fs.existsSync(atlasDataPath)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "backend-atlas-data.json not found. Run sbt generate-atlas." }));
        return;
      }
      const data = fs.readFileSync(atlasDataPath, "utf8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(data);
      return;
    }

    // API: dashboard config
    if (pathname === "/api/dashboard-config") {
      const pluginSections = collectDashboardSections(ctx);
      const sections = [...CORE_SECTIONS, ...pluginSections];
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ sections }));
      return;
    }

    // API: services (placeholder — could integrate logs plugin)
    if (pathname === "/api/services") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([]));
      return;
    }

    // API: events SSE (placeholder for watch integration)
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

    // Static files
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

    // SPA fallback
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
      // Force-close after 2s if connections linger
      setTimeout(() => resolve(), 2000).unref();
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
}

export const dashboardCommand = withHelp(DASHBOARD_HELP, runDashboard);
