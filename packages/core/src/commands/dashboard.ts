/**
 * dashboard command — Serve the React dashboard SPA with API routes.
 */
import { execSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveContainerPrefix, getArg, ui, withHelp } from "@sbtools/sdk";
import type { DashboardSectionDef, PluginContext } from "@sbtools/sdk";
import { allCommands } from "../command-registry.js";
import { runGenerateData } from "./generate-data.js";
import { BUILTIN_PLUGINS } from "../lib/plugin-catalog.js";

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
const PLUGIN_CONFIG_PATH = "supabase-tools.config.json";
const FILESYSTEM_CANDIDATES = ["dist/index.js", "index.js", "index.ts", "src/index.ts"];

interface PluginEntry {
  path: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

interface ConfigFile {
  plugins?: PluginEntry[];
  api?: { studioUrl?: string; inbucketUrl?: string };
  [key: string]: unknown;
}

interface RunningCommand {
  key: string;
  command: string;
  args: string[];
  pid: number;
  startedAt: string;
  child: ChildProcess;
}

interface CommandRule {
  requiresServices?: string[];
  requiresPlugins?: string[];
  longRunning?: boolean;
  singleton?: boolean;
}

interface CommandVariant {
  id: string;
  label: string;
  args: string[];
}

const COMMAND_RULES: Record<string, CommandRule> = {
  start: {},
  stop: {},
  restart: {},
  status: {},
  migrate: { requiresServices: ["db"] },
  snapshot: { requiresServices: ["db"] },
  watch: { requiresServices: ["db"], singleton: true, longRunning: true },
  "generate-atlas": {},
  docs: {},
  dashboard: { singleton: true, longRunning: true },
  init: {},
  plugin: {},
  "migration-studio": {
    requiresPlugins: ["@sbtools/plugin-migration-studio"],
    singleton: true,
    longRunning: true,
  },
  "migration-audit": { requiresPlugins: ["@sbtools/plugin-migration-audit"] },
  depgraph: { requiresPlugins: ["@sbtools/plugin-depgraph"] },
  "generate-types": { requiresPlugins: ["@sbtools/plugin-typegen"] },
  "db-test": { requiresPlugins: ["@sbtools/plugin-db-test"] },
  "logs-viewer": { requiresPlugins: ["@sbtools/plugin-logs"], singleton: true, longRunning: true },
  "deno-functions": { requiresPlugins: ["@sbtools/plugin-deno-functions"] },
  "frontend-usage": { requiresPlugins: ["@sbtools/plugin-frontend-usage"] },
  "plugin-scaffold": { requiresPlugins: ["@sbtools/plugin-scaffold"] },
};

const COMMAND_VARIANTS: Record<string, CommandVariant[]> = {
  docs: [
    { id: "docs-all", label: "Start docs", args: [] },
    { id: "docs-swagger", label: "Swagger", args: ["swagger"] },
    { id: "docs-redoc", label: "ReDoc", args: ["redoc"] },
    { id: "docs-schemaspy", label: "SchemaSpy", args: ["schemaspy"] },
    { id: "docs-stop", label: "Stop docs", args: ["stop"] },
  ],
};

function resolveDashboardDir(): string {
  const distDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  return path.join(distDir, "dashboard");
}

function readConfigFile(projectRoot: string): ConfigFile {
  const configPath = path.join(projectRoot, PLUGIN_CONFIG_PATH);
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as ConfigFile;
  } catch {
    return {};
  }
}

function writeConfigFile(projectRoot: string, cfg: ConfigFile): void {
  const configPath = path.join(projectRoot, PLUGIN_CONFIG_PATH);
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

function isPackageName(p: string): boolean {
  return p.startsWith("@") || (!p.startsWith(".") && !path.isAbsolute(p) && !p.includes("/") && !p.includes("\\"));
}

function isPluginInstalled(projectRoot: string, pluginPath: string): boolean {
  try {
    if (isPackageName(pluginPath)) {
      const rootPackagePath = path.join(projectRoot, "package.json");
      const req = createRequire(fs.existsSync(rootPackagePath) ? rootPackagePath : `${projectRoot}${path.sep}`);
      req.resolve(pluginPath);
      return true;
    }

    const pluginDir = path.isAbsolute(pluginPath) ? pluginPath : path.resolve(projectRoot, pluginPath);
    for (const candidate of FILESYSTEM_CANDIDATES) {
      if (fs.existsSync(path.join(pluginDir, candidate))) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function collectPluginState(ctx: PluginContext): Array<{
  name: string;
  description: string;
  builtin: boolean;
  configured: boolean;
  enabled: boolean;
  installed: boolean;
  loaded: boolean;
  source: "builtin" | "custom";
}> {
  const cfg = readConfigFile(ctx.projectRoot);
  const configured = cfg.plugins ?? [];
  const configuredMap = new Map(configured.map((entry) => [entry.path, entry]));
  const loaded = new Set((ctx.siblingPlugins ?? []).map((plugin) => plugin.name));

  const rows: Array<{
    name: string;
    description: string;
    builtin: boolean;
    configured: boolean;
    enabled: boolean;
    installed: boolean;
    loaded: boolean;
    source: "builtin" | "custom";
  }> = BUILTIN_PLUGINS.map((plugin) => {
    const entry = configuredMap.get(plugin.name);
    const loadedFlag = loaded.has(plugin.name);
    const configuredFlag = Boolean(entry) || loadedFlag;
    const enabled = entry ? entry.enabled !== false : loadedFlag;
    return {
      name: plugin.name,
      description: plugin.desc,
      builtin: true,
      configured: configuredFlag,
      enabled: configuredFlag ? enabled : false,
      installed: isPluginInstalled(ctx.projectRoot, plugin.name) || loadedFlag,
      loaded: loadedFlag,
      source: "builtin",
    };
  });

  for (const entry of configured) {
    if (rows.some((row) => row.name === entry.path)) continue;
    rows.push({
      name: entry.path,
      description: "Custom plugin",
      builtin: false,
      configured: true,
      enabled: entry.enabled !== false,
      installed: isPluginInstalled(ctx.projectRoot, entry.path),
      loaded: loaded.has(entry.path),
      source: "custom",
    });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

function applyPluginAction(projectRoot: string, action: "add" | "remove" | "enable" | "disable", pluginName: string): {
  changed: boolean;
  message: string;
} {
  const cfg = readConfigFile(projectRoot);
  const plugins: PluginEntry[] = cfg.plugins ?? [];
  const index = plugins.findIndex((entry) => entry.path === pluginName);

  if (action === "add") {
    if (index >= 0) return { changed: false, message: `Plugin '${pluginName}' is already configured.` };
    plugins.push({ path: pluginName, enabled: true, config: {} });
    cfg.plugins = plugins;
    writeConfigFile(projectRoot, cfg);
    return { changed: true, message: `Added plugin '${pluginName}'.` };
  }

  if (action === "remove") {
    if (index < 0) return { changed: false, message: `Plugin '${pluginName}' is not configured.` };
    cfg.plugins = plugins.filter((entry) => entry.path !== pluginName);
    writeConfigFile(projectRoot, cfg);
    return { changed: true, message: `Removed plugin '${pluginName}'.` };
  }

  if (index < 0) return { changed: false, message: `Plugin '${pluginName}' is not configured.` };

  if (action === "enable") {
    if (plugins[index].enabled !== false) return { changed: false, message: `Plugin '${pluginName}' is already enabled.` };
    plugins[index].enabled = true;
    cfg.plugins = plugins;
    writeConfigFile(projectRoot, cfg);
    return { changed: true, message: `Enabled plugin '${pluginName}'.` };
  }

  if (plugins[index].enabled === false) return { changed: false, message: `Plugin '${pluginName}' is already disabled.` };
  plugins[index].enabled = false;
  cfg.plugins = plugins;
  writeConfigFile(projectRoot, cfg);
  return { changed: true, message: `Disabled plugin '${pluginName}'.` };
}

function readJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => {
      raw += chunk.toString("utf8");
      if (raw.length > 1024 * 1024) {
        reject(new Error("Request body too large."));
      }
    });
    req.on("end", () => {
      try {
        resolve((raw ? JSON.parse(raw) : {}) as T);
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function commandKey(command: string, args: string[]): string {
  return `${command}::${args.join("\u0001")}`;
}

function installPluginPackage(projectRoot: string, pluginName: string): {
  attempted: boolean;
  success: boolean;
  output: string;
  error?: string;
} {
  if (!isPackageName(pluginName)) {
    return {
      attempted: false,
      success: false,
      output: "",
      error: "Automatic install is only supported for npm package plugins.",
    };
  }

  const result = spawnSync("npm", ["install", pluginName], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return {
    attempted: true,
    success: (result.status ?? 1) === 0,
    output: output.slice(-4000),
    error: (result.status ?? 1) === 0 ? undefined : `npm install exited with ${result.status ?? 1}`,
  };
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

async function probeUrl(url: string, timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === "https:" ? https : http;
      const req = client.request(
        {
          method: "GET",
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
          path: parsed.pathname || "/",
          timeout: timeoutMs,
        },
        (res) => {
          const ok = (res.statusCode ?? 500) < 500;
          res.resume();
          resolve(ok);
        },
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    } catch {
      resolve(false);
    }
  });
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

const BLOCKED_COMMANDS = new Set(["dashboard", "init"]);

function findSbtBin(projectRoot: string): string {
  const ext = process.platform === "win32" ? ".cmd" : "";
  const local = path.join(projectRoot, `node_modules/.bin/sbt${ext}`);
  if (fs.existsSync(local)) return local;
  return "sbt";
}

function getCommandRule(name: string, source: string): CommandRule {
  const baseRule = COMMAND_RULES[name] ?? {};
  if (source !== "core" && (!baseRule.requiresPlugins || baseRule.requiresPlugins.length === 0)) {
    return { ...baseRule, requiresPlugins: [source] };
  }
  return baseRule;
}

function collectCommands(
  ctx: PluginContext,
  running: Map<string, RunningCommand>,
): Array<{
  name: string;
  description: string;
  category: string;
  source: string;
  requiresPlugins: string[];
  missingPlugins: string[];
  requiresServices: string[];
  missingServices: string[];
  longRunning: boolean;
  singleton: boolean;
  running: { key: string; command: string; args: string[]; pid: number; startedAt: string } | null;
  variants: CommandVariant[];
  supportsStop: boolean;
  canRun: boolean;
  blockedReason: string | null;
}> {
  const commands: Array<{ name: string; description: string; category: string; source: string }> = [];
  for (const cmd of allCommands()) {
    commands.push({ name: cmd.name, description: cmd.description, category: cmd.category, source: "core" });
  }
  for (const plugin of ctx.siblingPlugins ?? []) {
    for (const cmd of plugin.commands ?? []) {
      commands.push({ name: cmd.name, description: cmd.description, category: plugin.name, source: plugin.name });
    }
  }

  const plugins = collectPluginState(ctx);
  const pluginMap = new Map(plugins.map((plugin) => [plugin.name, plugin]));
  const serviceStatusMap = new Map(getServiceStatuses(ctx.projectRoot).map((service) => [service.service, service.running]));

  return commands.map((command) => {
    const rule = getCommandRule(command.name, command.source);
    const requiresPlugins = rule.requiresPlugins ?? [];
    const missingPlugins = requiresPlugins.filter((plugin) => {
      const state = pluginMap.get(plugin);
      if (!state) return true;
      return !state.configured || !state.enabled || !state.installed;
    });
    const requiresServices = rule.requiresServices ?? [];
    const missingServices = requiresServices.filter((service) => !serviceStatusMap.get(service));
    const active = Array.from(running.values()).find((entry) => entry.command === command.name) ?? null;

    let blockedReason: string | null = null;
    if (missingPlugins.length > 0) blockedReason = `Missing plugin setup: ${missingPlugins.join(", ")}`;
    if (!blockedReason && missingServices.length > 0) blockedReason = `Required services are not running: ${missingServices.join(", ")}`;
    if (!blockedReason && rule.singleton && active) blockedReason = `Command '${command.name}' is already running.`;

    return {
      ...command,
      requiresPlugins,
      missingPlugins,
      requiresServices,
      missingServices,
      longRunning: Boolean(rule.longRunning),
      singleton: Boolean(rule.singleton),
      running: active
        ? { key: active.key, command: active.command, args: active.args, pid: active.pid, startedAt: active.startedAt }
        : null,
      variants: COMMAND_VARIANTS[command.name] ?? [],
      supportsStop: Boolean(rule.longRunning || command.name === "watch" || command.name === "migration-studio"),
      canRun: !blockedReason,
      blockedReason,
    };
  });
}

function createRequestHandler(ctx: PluginContext, dashboardDir: string) {
  const atlasDataPath = path.join(ctx.paths.docsOutput, "backend-atlas-data.json");
  const runningCommands = new Map<string, RunningCommand>();
  const eventClients = new Set<http.ServerResponse>();

  const emitEvent = (type: string, payload?: Record<string, unknown>) => {
    const message = JSON.stringify({ type, at: new Date().toISOString(), ...(payload ?? {}) });
    for (const client of eventClients) {
      try {
        client.write(`data: ${message}\n\n`);
      } catch {
        eventClients.delete(client);
      }
    }
  };

  const collectUiEndpoints = async () => {
    const cfg = readConfigFile(ctx.projectRoot);
    const docsSpecPath = path.join(ctx.sbtDataDir, "openapi-spec.json");
    const rows = [
      { id: "supabase-studio", label: "Supabase Studio", url: "http://localhost:54323", source: "supabase" },
      { id: "swagger-ui", label: "Swagger UI", url: "http://localhost:8081", source: "docs" },
      { id: "redoc", label: "ReDoc", url: "http://localhost:8082", source: "docs" },
      { id: "schemaspy", label: "SchemaSpy", url: "http://localhost:8083/schemaspy/", source: "docs" },
      { id: "migration-studio", label: "Migration Studio", url: "http://localhost:3335", source: "plugin" },
      { id: "dashboard", label: "SBT Dashboard", url: "http://localhost:3400", source: "core" },
      {
        id: "inbucket",
        label: "Inbucket",
        url: typeof cfg.api?.inbucketUrl === "string" && cfg.api.inbucketUrl ? cfg.api.inbucketUrl : "http://localhost:54324",
        source: "supabase",
      },
    ];

    const unique = new Map(rows.map((row) => [row.url, row]));
    const withHealth: Array<{ id: string; label: string; url: string; source: string; reachable: boolean }> = [];
    for (const row of unique.values()) {
      const reachable = await probeUrl(row.url);
      withHealth.push({ ...row, reachable });
    }

    return {
      docsSpecPresent: fs.existsSync(docsSpecPath),
      items: withHealth,
    };
  };

  return (req: http.IncomingMessage, res: http.ServerResponse): void => {
    const url = req.url ?? "/";
    const [pathname] = url.split("?");

    if (pathname === "/api/regenerate-atlas" && req.method === "POST") {
      runGenerateData()
        .then(() => {
          sendJson(res, 200, { success: true });
          emitEvent("atlas:regenerated", {});
        })
        .catch((err) => sendJson(res, 500, { success: false, error: (err as Error).message }));
      return;
    }

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

    if (pathname === "/api/plugins" && req.method === "GET") {
      const plugins = collectPluginState(ctx);
      sendJson(res, 200, { plugins });
      return;
    }

    if (pathname === "/api/plugins" && req.method === "POST") {
      readJsonBody<{ action?: "add" | "remove" | "enable" | "disable"; plugin?: string; install?: boolean }>(req)
        .then((body) => {
          const action = body.action;
          const pluginName = String(body.plugin ?? "").trim();
          if (!action || !pluginName) {
            sendJson(res, 400, { error: "Expected JSON body: { action, plugin }." });
            return;
          }

          const result = applyPluginAction(ctx.projectRoot, action, pluginName);
          const installResult = action === "add" && body.install === true
            ? installPluginPackage(ctx.projectRoot, pluginName)
            : null;
          const pluginState = collectPluginState(ctx).find((plugin) => plugin.name === pluginName);
          emitEvent("plugins:changed", { action, plugin: pluginName, changed: result.changed });
          if (installResult?.attempted) {
            emitEvent("plugins:installed", {
              plugin: pluginName,
              success: installResult.success,
            });
          }
          sendJson(res, 200, {
            ok: true,
            changed: result.changed,
            message: result.message,
            restartRequired: result.changed,
            installHint: isPackageName(pluginName) ? `npm install ${pluginName}` : null,
            install: installResult,
            plugin: pluginState ?? null,
          });
        })
        .catch((err) => {
          sendJson(res, 400, { error: (err as Error).message });
        });
      return;
    }

    if (pathname === "/api/services" || pathname === "/api/logs/services") {
      if (pathname === "/api/logs/services") {
        sendJson(res, 200, getServiceStatuses(ctx.projectRoot));
        return;
      }
      const services = getServiceStatuses(ctx.projectRoot);
      collectUiEndpoints()
        .then((uis) => sendJson(res, 200, { services, uis }))
        .catch(() => sendJson(res, 200, { services, uis: { docsSpecPresent: false, items: [] } }));
      return;
    }

    if (pathname === "/api/ui-endpoints") {
      collectUiEndpoints()
        .then((uis) => sendJson(res, 200, uis))
        .catch(() => sendJson(res, 200, { docsSpecPresent: false, items: [] }));
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
      eventClients.add(res);
      res.write(`data: ${JSON.stringify({ type: "init", at: new Date().toISOString() })}\n\n`);
      const interval = setInterval(() => res.write(": ping\n\n"), 30000);
      req.on("close", () => {
        clearInterval(interval);
        eventClients.delete(res);
      });
      return;
    }

    if (pathname === "/api/commands") {
      sendJson(res, 200, { commands: collectCommands(ctx, runningCommands) });
      return;
    }

    if (pathname === "/api/run/stop" && req.method === "POST") {
      readJsonBody<{ command?: string; args?: string[] }>(req)
        .then((body) => {
          const command = String(body.command ?? "").trim();
          const args = Array.isArray(body.args) ? body.args.map((entry) => String(entry)) : [];
          const key = commandKey(command, args);
          const active = runningCommands.get(key);
          if (!active) {
            sendJson(res, 404, { error: `No running process found for '${command}'.` });
            return;
          }

          try {
            active.child.kill("SIGTERM");
          } catch {
            // ignore
          }

          sendJson(res, 200, { ok: true, message: `Stopping '${command}'.` });
          emitEvent("command:stopping", { command, args });
        })
        .catch((err) => sendJson(res, 400, { error: (err as Error).message }));
      return;
    }

    if (pathname === "/api/run/stream") {
      const parsed = new URL(url, "http://localhost");
      const command = parsed.searchParams.get("command") ?? "";
      const argsRaw = parsed.searchParams.get("args");
      let runArgs: string[] = [];
      if (argsRaw) {
        try {
          const parsedArgs = JSON.parse(argsRaw) as unknown;
          if (Array.isArray(parsedArgs)) runArgs = parsedArgs.map((entry) => String(entry));
        } catch {
          sendJson(res, 400, { error: "Invalid args payload." });
          return;
        }
      }
      const commands = collectCommands(ctx, runningCommands);
      const commandInfo = commands.find((item) => item.name === command);
      const knownCommands = new Set(commands.map((c) => c.name));
      const key = commandKey(command, runArgs);

      if (!command || BLOCKED_COMMANDS.has(command) || !knownCommands.has(command)) {
        sendJson(res, 400, { error: `Command '${command}' cannot be invoked from the dashboard.` });
        return;
      }
      if (!commandInfo?.canRun) {
        sendJson(res, 409, { error: commandInfo?.blockedReason ?? `Command '${command}' is currently blocked.` });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const bin = findSbtBin(ctx.projectRoot);
      const child = spawn(bin, [command, ...runArgs], {
        cwd: ctx.projectRoot,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      });
      if (child.pid) {
        runningCommands.set(key, {
          key,
          command,
          args: runArgs,
          pid: child.pid,
          startedAt: new Date().toISOString(),
          child,
        });
      }

      emitEvent("command:started", { command, args: runArgs, pid: child.pid ?? null });
      res.write(`data: ${JSON.stringify({ type: "start", command, args: runArgs, pid: child.pid })}\n\n`);

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
        runningCommands.delete(key);
        emitEvent("command:finished", {
          command,
          args: runArgs,
          code: code ?? 1,
          success: code === 0,
        });
        res.write(`data: ${JSON.stringify({ type: "exit", code: code ?? 1, success: code === 0 })}\n\n`);
        res.end();
      });

      child.on("error", (err) => {
        runningCommands.delete(key);
        emitEvent("command:finished", { command, args: runArgs, code: 1, success: false });
        res.write(`data: ${JSON.stringify({ type: "stderr", line: `Failed to start process: ${(err as Error).message}` })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "exit", code: 1, success: false })}\n\n`);
        res.end();
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
