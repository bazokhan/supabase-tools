/**
 * HTTP + SSE server for the live log viewer.
 *
 * Routes:
 *   GET /             — Serves the single-page HTML viewer
 *   GET /stream       — SSE endpoint (query: services=all|fn,db,...)
 *   GET /pg-stats     — pg_stat_statements JSON (query: sort=total|slow|frequent)
 *   POST /pg-stats-reset — Reset pg_stat_statements
 *   GET /services     — Service health JSON
 *
 * Uses only Node built-in `http` module. Zero dependencies.
 */
import http from "node:http";
import { URL } from "node:url";
import {
  deriveContainerPrefix,
  getContainerName,
  getServiceStatuses,
  getDbContainerName,
  tailLogs,
  registerChild,
  killAllChildren,
  SERVICE_NAMES,
} from "./docker-logs.js";
import { parseLogLine } from "./formatter.js";
import { buildViewerHtml } from "./viewer-html.js";
import {
  getTopQueries,
  getSlowQueries,
  getFrequentQueries,
  resetStats,
} from "./pg-stats.js";

// Re-use the PluginContext shape (duck-typed)
interface PluginContext {
  projectRoot: string;
  toolsDir: string;
  pluginConfig: Record<string, unknown>;
  apiUrl: string;
  functionsPath: string;
  docsOutput: string;
}

export async function startViewer(
  ctx: PluginContext,
  opts: { port?: number } = {},
): Promise<void> {
  const port =
    opts.port ??
    (ctx.pluginConfig.viewerPort as number | undefined) ??
    3333;
  const tailLines =
    (ctx.pluginConfig.tailLines as number | undefined) ?? 100;
  const prefix = deriveContainerPrefix(ctx.projectRoot);
  const dbContainer = getDbContainerName(ctx.projectRoot, ctx.pluginConfig);

  // Pre-build the HTML once (it's static for a given port)
  const html = buildViewerHtml(port);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    // CORS headers for the viewer
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // ---- Routes ----

    if (url.pathname === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (url.pathname === "/stream" && req.method === "GET") {
      handleSSE(req, res, url, prefix, tailLines);
      return;
    }

    if (url.pathname === "/pg-stats" && req.method === "GET") {
      const sort = url.searchParams.get("sort") ?? "total";
      let data;
      switch (sort) {
        case "slow":
          data = getSlowQueries(dbContainer);
          break;
        case "frequent":
          data = getFrequentQueries(dbContainer);
          break;
        default:
          data = getTopQueries(dbContainer);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
      return;
    }

    if (url.pathname === "/pg-stats-reset" && req.method === "POST") {
      const result = resetStats(dbContainer);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }

    if (url.pathname === "/services" && req.method === "GET") {
      const statuses = getServiceStatuses(ctx.projectRoot);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(statuses));
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`\nLog viewer running at: http://localhost:${port}`);
      console.log("Press Ctrl+C to stop.\n");
    });

    // Keep the server running until killed
    const onExit = () => {
      killAllChildren();
      server.close();
      resolve();
    };
    process.on("SIGINT", onExit);
    process.on("SIGTERM", onExit);
  });
}

// ---------------------------------------------------------------------------
// SSE handler
// ---------------------------------------------------------------------------

function handleSSE(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  prefix: string,
  tailLines: number,
): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const servicesParam = url.searchParams.get("services") ?? "all";
  const requestedServices =
    servicesParam === "all" || servicesParam === ""
      ? [...SERVICE_NAMES]
      : servicesParam.split(",").filter((s) => SERVICE_NAMES.includes(s));

  if (requestedServices.length === 0) {
    res.write("data: {\"service\":\"system\",\"level\":\"warn\",\"timestamp\":\"\",\"message\":\"No valid services requested\"}\n\n");
    return;
  }

  const children: ReturnType<typeof tailLogs>[] = [];

  for (const service of requestedServices) {
    const container = getContainerName(prefix, service);

    const child = tailLogs(container, { tail: tailLines });
    registerChild(child);
    children.push(child);

    const handleData = (stream: NodeJS.ReadableStream) => {
      let buffer = "";
      stream.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = parseLogLine(service, line);
          const json = JSON.stringify(parsed);
          res.write(`data: ${json}\n\n`);
        }
      });
    };

    if (child.stdout) handleData(child.stdout);
    if (child.stderr) handleData(child.stderr);

    child.on("error", () => {
      res.write(
        `data: ${JSON.stringify({ service, level: "error", timestamp: "", message: `Failed to tail ${container}` })}\n\n`,
      );
    });
  }

  // Clean up when the client disconnects
  _req.on("close", () => {
    for (const child of children) {
      try {
        child.kill("SIGTERM");
      } catch {
        /* already dead */
      }
    }
  });
}
