/**
 * @sbtools/plugin-logs
 *
 * Plugin for supabase-tools that provides live Docker log tailing,
 * pg_stat_statements query performance monitoring, a standalone HTML
 * log viewer, and Atlas integration for service health and query stats.
 *
 * Activated by adding an entry in supabase-tools.config.json:
 *
 *   "plugins": [{
 *     "path": "node_modules/@sbtools/plugin-logs",
 *     "config": {
 *       "viewerPort": 3333,
 *       "tailLines": 100,
 *       "dbContainer": "supabase-db"
 *     }
 *   }]
 */
import { createRequire } from "node:module";
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";

const require = createRequire(import.meta.url);
import { hasFlag, getArg } from "@sbtools/sdk";
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
import { formatLogLine } from "./formatter.js";
import {
  getTopQueries,
  getSlowQueries,
  getFrequentQueries,
  resetStats,
  formatStatsTable,
} from "./pg-stats.js";
import { startViewer } from "./viewer.js";
import { logsSectionHtml } from "./atlas/sections.js";
import { logsCardRendererJs } from "./atlas/cards.js";
import { logsStyles } from "./atlas/styles.js";

// ---------------------------------------------------------------------------
// CLI: logs command
// ---------------------------------------------------------------------------

async function logsCommand(args: string[], ctx: PluginContext): Promise<void> {
  // ---- Help ----
  if (hasFlag(args, "--help", "-h")) {
    console.log(`
logs — Live Docker log tailing, pg_stat_statements monitoring, and log viewer

Usage:
  sbt logs [service] [options]
  sbt logs pg-stats [options]
  sbt logs viewer [options]

Services:
  ${SERVICE_NAMES.join(", ")}

Log tailing:
  sbt logs                  Tail all running services (multiplexed, coloured)
  sbt logs --all            Same as above
  sbt logs <service>        Tail a single service (e.g. sbt logs functions)
  sbt logs --list           List services with running/stopped status

  --tail <N>                Number of historical lines (default: 100)
  --no-color                Disable ANSI colours
  --timestamps              Show Docker timestamps

Query performance:
  sbt logs pg-stats         Top 20 queries by total execution time
  sbt logs pg-stats --slow  Top 20 by mean execution time
  sbt logs pg-stats --frequent  Top 20 by call count
  sbt logs pg-stats --reset Reset pg_stat_statements
  sbt logs pg-stats --json  Output raw JSON

Log viewer:
  sbt logs viewer           Start live HTML log viewer (default port: 3333)
  sbt logs viewer --port N  Custom port

Plugin config (in supabase-tools.config.json → plugins[].config):
  viewerPort    Default viewer port (default: 3333)
  tailLines     Default tail line count (default: 100)
  dbContainer   DB container suffix (default: "supabase-db")
`);
    return;
  }

  const subcommand = args[0];

  // ---- pg-stats ----
  if (subcommand === "pg-stats") {
    await handlePgStats(args.slice(1), ctx);
    return;
  }

  // ---- viewer ----
  if (subcommand === "viewer") {
    const portStr = getArg(args, "--port");
    const port = portStr ? parseInt(portStr, 10) : undefined;
    await startViewer(ctx, { port });
    return;
  }

  // ---- --list ----
  if (hasFlag(args, "--list")) {
    const statuses = getServiceStatuses(ctx.projectRoot);
    console.log("\nSupabase Service Status\n");
    console.log(
      "  " +
      "Service".padEnd(14) +
      "Container".padEnd(40) +
      "Status",
    );
    console.log("  " + "-".repeat(70));
    for (const s of statuses) {
      const icon = s.running ? "\x1b[32m●\x1b[0m" : "\x1b[31m●\x1b[0m";
      console.log(
        `  ${icon} ${s.service.padEnd(12)} ${s.container.padEnd(40)} ${s.status}`,
      );
    }
    console.log("");
    return;
  }

  // ---- Tail logs ----
  const tailLines = parseInt(getArg(args, "--tail") ?? String(ctx.pluginConfig.tailLines ?? 100), 10);
  const noColor = hasFlag(args, "--no-color");
  const timestamps = hasFlag(args, "--timestamps");

  let services: string[];
  if (!subcommand || subcommand === "--all" || subcommand.startsWith("-")) {
    // Tail all services
    services = [...SERVICE_NAMES];
  } else if (SERVICE_NAMES.includes(subcommand)) {
    services = [subcommand];
  } else {
    console.error(
      `Unknown service: ${subcommand}\nAvailable: ${SERVICE_NAMES.join(", ")}`,
    );
    process.exit(1);
  }

  const prefix = deriveContainerPrefix(ctx.projectRoot);

  // Check which are running
  const statuses = getServiceStatuses(ctx.projectRoot);
  const running = statuses
    .filter((s) => s.running && services.includes(s.service))
    .map((s) => s.service);

  if (running.length === 0) {
    console.error(
      "No running containers found for the requested services.\n" +
      "Run `sbt start` first, or use `sbt logs --list` to check status.",
    );
    process.exit(1);
  }

  if (running.length < services.length) {
    const stopped = services.filter((s) => !running.includes(s));
    console.log(
      `\x1b[33mSkipping stopped services: ${stopped.join(", ")}\x1b[0m\n`,
    );
  }

  console.log(
    `Tailing ${running.length} service(s): ${running.join(", ")}  (Ctrl+C to stop)\n`,
  );

  for (const service of running) {
    const container = getContainerName(prefix, service);
    const child = tailLogs(container, { tail: tailLines, timestamps });
    registerChild(child);

    const handleData = (stream: NodeJS.ReadableStream) => {
      let buffer = "";
      stream.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          console.log(formatLogLine(service, line, { noColor }));
        }
      });
    };

    if (child.stdout) handleData(child.stdout);
    if (child.stderr) handleData(child.stderr);
  }

  // Block until killed
  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      killAllChildren();
      console.log("\nStopped.");
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// pg-stats subcommand
// ---------------------------------------------------------------------------

async function handlePgStats(args: string[], ctx: PluginContext): Promise<void> {
  const dbContainer = getDbContainerName(ctx.projectRoot, ctx.pluginConfig);

  if (hasFlag(args, "--reset")) {
    const result = resetStats(dbContainer);
    if (result.ok) {
      console.log("pg_stat_statements reset successfully.");
    } else {
      console.error(`Failed to reset: ${result.error}`);
    }
    return;
  }

  let snapshot;
  if (hasFlag(args, "--slow")) {
    snapshot = getSlowQueries(dbContainer);
  } else if (hasFlag(args, "--frequent")) {
    snapshot = getFrequentQueries(dbContainer);
  } else {
    snapshot = getTopQueries(dbContainer);
  }

  if (hasFlag(args, "--json")) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(formatStatsTable(snapshot));
  }
}

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-logs",
  version: (require("../package.json") as { version: string }).version,

  commands: [
    {
      name: "logs",
      description:
        "Live Docker log tailing, pg_stat_statements, and log viewer",
      run: logsCommand,
    },
  ],

  getAtlasData: async (ctx: PluginContext) => {
    const dbContainer = getDbContainerName(ctx.projectRoot, ctx.pluginConfig);
    const statuses = getServiceStatuses(ctx.projectRoot);

    // Collect pg_stat_statements snapshot (top 10)
    const snapshot = getTopQueries(dbContainer, 10);

    return {
      categories: {
        query_performance: snapshot.available ? snapshot.queries : [],
        service_health: statuses,
      },
      stats: [
        { label: "DB Queries Tracked", value: snapshot.total_tracked },
        {
          label: "Services Running",
          value: statuses.filter((s) => s.running).length,
        },
      ],
    };
  },

  getAtlasUI: () => ({
    kindLabels: {
      query_performance: "Query Performance",
      service_health: "Service Health",
    },
    sectionHtml: logsSectionHtml(),
    cardRendererJs: logsCardRendererJs(),
    initJs: [
      'renderSection("query-performance-list", data.categories.query_performance || [], renderQueryPerfCard, "queries");',
      'renderSection("service-health-list", data.categories.service_health || [], renderServiceHealthCard, "services");',
    ].join("\n    "),
    styles: logsStyles(),
  }),

  getStatusLines: async (ctx: PluginContext) => {
    const statuses = getServiceStatuses(ctx.projectRoot);
    const running = statuses.filter((s) => s.running);
    const stopped = statuses.filter((s) => !s.running);

    const lines: string[] = [];
    lines.push(
      `  Services: ${running.length} running, ${stopped.length} stopped`,
    );

    for (const s of statuses) {
      const icon = s.running ? "●" : "○";
      lines.push(`  ${icon} ${s.service.padEnd(14)} ${s.status}`);
    }

    // pg_stat_statements summary
    const dbContainer = getDbContainerName(ctx.projectRoot, ctx.pluginConfig);
    const snapshot = getTopQueries(dbContainer, 3);
    if (snapshot.available && snapshot.queries.length > 0) {
      lines.push("");
      lines.push(`  pg_stat_statements: ${snapshot.total_tracked} queries tracked`);
      lines.push(`  Top 3 by total time:`);
      for (const q of snapshot.queries) {
        const queryShort =
          q.query.length > 50 ? q.query.substring(0, 50) + "..." : q.query;
        lines.push(
          `    ${queryShort.padEnd(55)} ${q.total_exec_time_ms.toFixed(1)}ms (${q.calls} calls)`,
        );
      }
    } else if (!snapshot.available) {
      lines.push("");
      lines.push("  pg_stat_statements: not available");
    }

    return lines;
  },
};

export default plugin;
