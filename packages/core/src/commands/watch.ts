import fs from "node:fs";
import path from "node:path";
import type { FSWatcher } from "node:fs";
import { Client } from "pg";
import { getArg, hasFlag, SbtError, ui } from "@sbtools/sdk";
import { config, getDbUrl } from "../config.js";
import { loadPlugins, buildPluginContext, type LoadedPlugin } from "../plugin-loader.js";
import { createDebouncedSingleFlightScheduler } from "../watch/scheduler.js";
import { installDbWatchHooks } from "../watch/db-hooks.js";

type WatchEvent = {
  source: "db" | "fs" | "runner";
  eventType: string;
  reason?: string;
  at: string;
  payload?: unknown;
};

const WATCH_STAMP_PATH = path.join(config.sbtDataDir, "watch", "last-event.json");
const WATCH_CHANNEL = "sbt_watch_events";

function writeWatchStamp(event: WatchEvent): void {
  fs.mkdirSync(path.dirname(WATCH_STAMP_PATH), { recursive: true });
  fs.writeFileSync(WATCH_STAMP_PATH, JSON.stringify(event, null, 2) + "\n", "utf8");
}

function parseDebounceMs(args: string[]): number {
  const raw = getArg(args, "--debounce-ms");
  const parsed = raw ? Number.parseInt(raw, 10) : 1500;
  if (!Number.isFinite(parsed) || parsed < 0) return 1500;
  return parsed;
}

function resolveMigrationAuditCommand(loadedPlugins: LoadedPlugin[]): {
  loaded: LoadedPlugin;
  run: (ctx: ReturnType<typeof buildPluginContext>) => Promise<void>;
} {
  for (const loaded of loadedPlugins) {
    const command = loaded.plugin.commands?.find((c) => c.name === "migration-audit");
    if (command) {
      return {
        loaded,
        run: async (ctx) => {
          await command.run(["--no-open"], ctx);
        },
      };
    }
  }
  throw new SbtError(
    "PREFLIGHT_FAILED",
    "watch scope 'migration' requires @sbtools/plugin-migration-audit to be configured.",
    {
      tips: [
        'Add plugin entry: { "path": "@sbtools/plugin-migration-audit", "config": {} }',
      ],
    }
  );
}

export async function runWatch(args: string[]): Promise<void> {
  if (hasFlag(args, "--help", "-h")) {
    console.log(`
watch — Keep plugin artifacts fresh in near real time

Usage:
  sbt watch
  sbt watch --scope migration
  sbt watch --debounce-ms 1000
  sbt watch --no-db-hooks

Options:
  --scope <name>      Watch scope (phase 1 supports: migration)
  --debounce-ms <n>   Debounce interval for bursty events (default: 1500)
  --no-db-hooks       Skip DB helper trigger/event-trigger installation
  --verbose           Print raw event payloads
  -h, --help          Show help
`);
    return;
  }

  const scope = getArg(args, "--scope") ?? "migration";
  if (scope !== "migration") {
    throw new SbtError("COMMAND_FAILED", `Unsupported watch scope: ${scope}`, {
      tips: ["Use --scope migration"],
    });
  }

  const debounceMs = parseDebounceMs(args);
  const verbose = hasFlag(args, "--verbose");
  const useDbHooks = !hasFlag(args, "--no-db-hooks");

  const loadedPlugins = await loadPlugins();
  const migrationAudit = resolveMigrationAuditCommand(loadedPlugins);
  const pluginCtx = buildPluginContext(migrationAudit.loaded, loadedPlugins);

  let dbClient: Client | null = null;
  let dbReconnectTimer: NodeJS.Timeout | null = null;
  const fsWatchers: FSWatcher[] = [];
  let shuttingDown = false;

  const runPipeline = async (): Promise<void> => {
    ui.step("watch: running migration refresh pipeline...");
    await migrationAudit.run(pluginCtx);
    writeWatchStamp({
      source: "runner",
      eventType: "pipeline_complete",
      at: new Date().toISOString(),
    });
    ui.success("watch: pipeline complete");
  };

  const scheduler = createDebouncedSingleFlightScheduler({
    debounceMs,
    run: runPipeline,
  });

  const onEvent = (event: WatchEvent): void => {
    writeWatchStamp(event);
    if (verbose && event.payload !== undefined) {
      ui.detail(`watch event (${event.source}/${event.eventType}): ${JSON.stringify(event.payload)}`);
    } else {
      ui.detail(`watch event (${event.source}/${event.eventType})`);
    }
    scheduler.schedule();
  };

  const connectDbListener = async (): Promise<void> => {
    if (shuttingDown) return;
    const client = new Client({ connectionString: getDbUrl() });
    try {
      await client.connect();
      dbClient = client;

      if (useDbHooks) {
        const install = await installDbWatchHooks(client);
        if (!install.eventTriggerInstalled) {
          ui.warn("watch: DDL event trigger not installed (permission-limited). Table-level notifications still enabled.");
        }
      }

      await client.query(`LISTEN ${WATCH_CHANNEL}`);
      ui.success("watch: DB listener connected");
    } catch (error) {
      ui.warn(`watch: DB listener unavailable (${(error as Error).message}). Retrying in 3s...`);
      try {
        await client.end();
      } catch {
        // ignore
      }
      if (!shuttingDown) {
        dbReconnectTimer = setTimeout(() => void connectDbListener(), 3000);
      }
      return;
    }

    client.on("notification", (msg) => {
      const payloadText = msg.payload ?? "";
      let payload: unknown = payloadText;
      try {
        payload = payloadText ? JSON.parse(payloadText) : null;
      } catch {
        // keep raw payload text
      }
      onEvent({
        source: "db",
        eventType: "notify",
        at: new Date().toISOString(),
        payload,
      });
    });

    client.on("error", (error) => {
      ui.warn(`watch: DB listener error (${error.message}). Reconnecting...`);
    });

    client.on("end", () => {
      if (!shuttingDown) {
        dbReconnectTimer = setTimeout(() => void connectDbListener(), 3000);
      }
    });
  };

  const watchMigrationsDir = (): void => {
    if (!fs.existsSync(pluginCtx.paths.migrations)) {
      fs.mkdirSync(pluginCtx.paths.migrations, { recursive: true });
    }

    const watcher = fs.watch(pluginCtx.paths.migrations, (_eventType, filename) => {
      const name = filename?.toString() ?? "";
      if (!name.endsWith(".sql")) return;
      onEvent({
        source: "fs",
        eventType: "migration_file_changed",
        reason: name,
        at: new Date().toISOString(),
      });
    });
    fsWatchers.push(watcher);
  };

  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    scheduler.stop();
    for (const watcher of fsWatchers) watcher.close();
    if (dbReconnectTimer) clearTimeout(dbReconnectTimer);
    if (dbClient) {
      try {
        await dbClient.end();
      } catch {
        // ignore
      }
    }
  };

  process.once("SIGINT", () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0));
  });

  ui.heading("Starting watch mode");
  ui.detail(`scope=${scope} debounceMs=${debounceMs} dbHooks=${useDbHooks}`);
  watchMigrationsDir();
  void connectDbListener();
  scheduler.requestImmediate();

  await new Promise<void>(() => {
    // Keep process alive until signal.
  });
}
