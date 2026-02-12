/**
 * Docker container discovery and log tailing.
 *
 * Resolves container names from the project config (same prefix derivation
 * as cli.ts), checks running status via `docker inspect`, and spawns
 * `docker logs -f` child processes with proper lifecycle management.
 */
import { spawn, execSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Service map
// ---------------------------------------------------------------------------

export const SERVICE_MAP: Record<string, string> = {
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

export const SERVICE_NAMES = Object.keys(SERVICE_MAP);

// ---------------------------------------------------------------------------
// Container prefix derivation (mirrors cli.ts logic)
// ---------------------------------------------------------------------------

export function deriveContainerPrefix(projectRoot: string): string {
  let projectName = path.basename(projectRoot);
  const configPath = path.join(projectRoot, "supabase-tools.config.json");
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (cfg?.project?.name) projectName = cfg.project.name;
    } catch {
      /* use fallback */
    }
  }
  return (
    projectName
      .replace(/[^a-zA-Z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "sbt"
  );
}

// ---------------------------------------------------------------------------
// Container helpers
// ---------------------------------------------------------------------------

export function getContainerName(prefix: string, service: string): string {
  const suffix = SERVICE_MAP[service];
  if (!suffix) throw new Error(`Unknown service: ${service}`);
  return `${prefix}-${suffix}`;
}

export interface ContainerStatus {
  service: string;
  container: string;
  running: boolean;
  status: string; // e.g. "Up 2 hours", "Exited (0) 5 minutes ago"
}

export function isContainerRunning(container: string): boolean {
  try {
    const out = execSync(
      `docker inspect --format "{{.State.Running}}" "${container}"`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    return out === "true";
  } catch {
    return false;
  }
}

function getContainerStatusText(container: string): string {
  try {
    return execSync(
      `docker inspect --format "{{.State.Status}}" "${container}"`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
  } catch {
    return "not found";
  }
}

export function getServiceStatuses(projectRoot: string): ContainerStatus[] {
  const prefix = deriveContainerPrefix(projectRoot);
  return SERVICE_NAMES.map((service) => {
    const container = getContainerName(prefix, service);
    const running = isContainerRunning(container);
    const status = getContainerStatusText(container);
    return { service, container, running, status };
  });
}

export function getDbContainerName(
  projectRoot: string,
  pluginConfig: Record<string, unknown>,
): string {
  const prefix = deriveContainerPrefix(projectRoot);
  const dbSuffix =
    (pluginConfig.dbContainer as string) ?? "supabase-db";
  return `${prefix}-${dbSuffix}`;
}

// ---------------------------------------------------------------------------
// Log tailing
// ---------------------------------------------------------------------------

export interface TailOptions {
  tail?: number;
  timestamps?: boolean;
}

export function tailLogs(
  container: string,
  opts: TailOptions = {},
): ChildProcess {
  const args = ["logs", "-f", "--tail", String(opts.tail ?? 100)];
  if (opts.timestamps) args.push("--timestamps");
  args.push(container);
  return spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
}

// ---------------------------------------------------------------------------
// Process lifecycle management
// ---------------------------------------------------------------------------

const activeChildren: Set<ChildProcess> = new Set();

export function registerChild(child: ChildProcess): void {
  activeChildren.add(child);
  child.on("exit", () => activeChildren.delete(child));
}

export function killAllChildren(): void {
  for (const child of activeChildren) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* already dead */
    }
  }
  activeChildren.clear();
}

function onExit() {
  killAllChildren();
}

process.on("SIGINT", onExit);
process.on("SIGTERM", onExit);
