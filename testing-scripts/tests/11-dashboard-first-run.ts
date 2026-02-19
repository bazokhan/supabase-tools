/**
 * Test: dashboard first-run operational flow
 *
 * Expected:
 *  - /api/atlas-data returns 404 before atlas generation
 *  - operational routes remain reachable (migration-studio, runner, plugins, services)
 *  - plugin API add/disable works for migration studio plugin
 *  - command gating reports missing db for migrate/snapshot when services are down
 *  - filesystem-path plugin load counts as configured/installed for command gating
 *  - /api/services returns both service rows and UI endpoint inventory
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { assert, REPO_ROOT, log } from "../utils.js";

export const name = "dashboard first-run — operational routes + plugin/command/service APIs";

const CORE_DIST_CLI = path.join(REPO_ROOT, "packages", "core", "dist", "cli.js");
const START_TIMEOUT_MS = 15000;

interface DashboardHandle {
  proc: ChildProcessWithoutNullStreams;
  baseUrl: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readConfig(targetDir: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(targetDir, "supabase-tools.config.json"), "utf8")) as Record<string, unknown>;
}

function writeConfig(targetDir: string, cfg: Record<string, unknown>): void {
  fs.writeFileSync(path.join(targetDir, "supabase-tools.config.json"), JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

async function findOpenPort(): Promise<number> {
  const net = await import("node:net");
  const server = net.createServer();
  const port = await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("failed to allocate open port"));
        return;
      }
      resolve(addr.port);
    });
  });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function startDashboard(targetDir: string, port: number): Promise<DashboardHandle> {
  const baseUrl = `http://localhost:${port}`;
  const proc = spawn("node", [CORE_DIST_CLI, "dashboard", "--port", String(port)], {
    cwd: targetDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
  });

  let started = false;
  let stdout = "";
  let stderr = "";

  proc.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    stdout += text;
    if (text.includes(`Dashboard at ${baseUrl}`)) started = true;
  });
  proc.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  const t0 = Date.now();
  while (!started && Date.now() - t0 < START_TIMEOUT_MS) {
    if (proc.exitCode !== null) break;
    await sleep(100);
  }
  if (!started) {
    try { proc.kill("SIGTERM"); } catch { /* ignore */ }
    throw new Error(`dashboard failed to start at ${baseUrl}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  }
  return { proc, baseUrl };
}

async function stopDashboard(handle: DashboardHandle | null): Promise<void> {
  if (!handle || handle.proc.exitCode !== null) return;
  const waitForExit = async (timeoutMs: number): Promise<boolean> =>
    new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        resolve(false);
      }, timeoutMs);
      handle.proc.once("exit", () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(true);
      });
    });

  try { handle.proc.kill("SIGTERM"); } catch { /* ignore */ }
  const exited = await waitForExit(2500);
  if (!exited && handle.proc.exitCode === null) {
    try { handle.proc.kill("SIGKILL"); } catch { /* ignore */ }
    await waitForExit(1200);
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} for ${url}\n${body}`);
  }
  return (await res.json()) as T;
}

async function assertStatus(url: string, expected: number): Promise<void> {
  const res = await fetch(url);
  assert(res.status === expected, `expected ${url} => ${expected}, got ${res.status}`);
}

export async function run(targetDir: string): Promise<void> {
  let dashboard: DashboardHandle | null = null;
  const port = await findOpenPort();

  try {
    log.info(`using dynamic dashboard port ${port}`);

    // init using built CLI so dashboard assets resolve from dist/
    log.info("running sbt init (dist cli)");
    const init = await import("node:child_process").then(({ spawnSync }) =>
      spawnSync("node", [CORE_DIST_CLI, "init"], {
        cwd: targetDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      })
    );
    if ((init.status ?? 1) !== 0) {
      throw new Error(`init failed\n${init.stdout ?? ""}${init.stderr ?? ""}`);
    }
    log.output((init.stdout ?? "") + (init.stderr ?? ""));

    log.info("starting dashboard");
    dashboard = await startDashboard(targetDir, port);
    log.output(`Dashboard at ${dashboard.baseUrl}`);

    // 1) atlas missing + operational routes reachable
    log.info("asserting first-run route behavior with missing atlas data");
    await assertStatus(`${dashboard.baseUrl}/api/atlas-data`, 404);
    await assertStatus(`${dashboard.baseUrl}/migration-studio`, 200);
    await assertStatus(`${dashboard.baseUrl}/runner`, 200);
    await assertStatus(`${dashboard.baseUrl}/plugins`, 200);
    await assertStatus(`${dashboard.baseUrl}/services`, 200);
    log.output("/api/atlas-data => 404");
    log.output("/migration-studio => 200");
    log.output("/runner => 200");
    log.output("/plugins => 200");
    log.output("/services => 200");

    // 2) plugin API add + disable
    log.info("validating plugin API add/disable flow");
    type PluginRow = { name: string; configured: boolean; enabled: boolean; installed: boolean; loaded: boolean };
    const before = await requestJson<{ plugins: PluginRow[] }>(`${dashboard.baseUrl}/api/plugins`);
    const studioBefore = before.plugins.find((p) => p.name === "@sbtools/plugin-migration-studio");
    assert(Boolean(studioBefore), "expected @sbtools/plugin-migration-studio row in /api/plugins");
    assert(studioBefore?.configured === false, "studio plugin should start not configured");
    log.output(
      `before add: configured=${studioBefore?.configured} enabled=${studioBefore?.enabled} installed=${studioBefore?.installed} loaded=${studioBefore?.loaded}`,
    );

    const addRes = await requestJson<{ changed: boolean; restartRequired: boolean }>(`${dashboard.baseUrl}/api/plugins`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "add", plugin: "@sbtools/plugin-migration-studio" }),
    });
    assert(addRes.changed === true, "plugin add should return changed=true");
    assert(addRes.restartRequired === true, "plugin add should require dashboard restart");
    log.output(`add result: changed=${addRes.changed} restartRequired=${addRes.restartRequired}`);

    const added = await requestJson<{ plugins: PluginRow[] }>(`${dashboard.baseUrl}/api/plugins`);
    const studioAdded = added.plugins.find((p) => p.name === "@sbtools/plugin-migration-studio");
    assert(studioAdded?.configured === true, "studio plugin should be configured after add");
    assert(studioAdded?.enabled === true, "studio plugin should be enabled after add");
    log.output(
      `after add: configured=${studioAdded?.configured} enabled=${studioAdded?.enabled} installed=${studioAdded?.installed} loaded=${studioAdded?.loaded}`,
    );

    const disableRes = await requestJson<{ changed: boolean }>(`${dashboard.baseUrl}/api/plugins`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "disable", plugin: "@sbtools/plugin-migration-studio" }),
    });
    assert(disableRes.changed === true, "plugin disable should return changed=true");
    log.output(`disable result: changed=${disableRes.changed}`);

    // 3) command gating for db-required commands
    log.info("validating command gating when db service is not running");
    type CommandRow = { name: string; canRun: boolean; missingServices: string[]; missingPlugins: string[] };
    const commands = await requestJson<{ commands: CommandRow[] }>(`${dashboard.baseUrl}/api/commands`);
    const migrate = commands.commands.find((c) => c.name === "migrate");
    const snapshot = commands.commands.find((c) => c.name === "snapshot");
    assert(Boolean(migrate), "migrate missing from /api/commands");
    assert(Boolean(snapshot), "snapshot missing from /api/commands");
    assert(migrate?.canRun === false && migrate.missingServices.includes("db"), "migrate should be blocked by missing db");
    assert(snapshot?.canRun === false && snapshot.missingServices.includes("db"), "snapshot should be blocked by missing db");
    log.output(`migrate: canRun=${migrate?.canRun} missingServices=${migrate?.missingServices.join(",")}`);
    log.output(`snapshot: canRun=${snapshot?.canRun} missingServices=${snapshot?.missingServices.join(",")}`);

    // 4) restart dashboard with filesystem path plugin and verify no false missing-plugin block
    log.info("restarting dashboard with filesystem-path plugin config");
    await stopDashboard(dashboard);
    dashboard = null;

    const cfg = readConfig(targetDir);
    cfg.plugins = [
      {
        path: path.join(REPO_ROOT, "packages", "plugin-migration-studio").replace(/\\/g, "/"),
        enabled: true,
        config: {},
      },
    ];
    writeConfig(targetDir, cfg);

    dashboard = await startDashboard(targetDir, port);
    log.output(`Dashboard restarted at ${dashboard.baseUrl}`);
    const commandsWithPathPlugin = await requestJson<{ commands: CommandRow[] }>(`${dashboard.baseUrl}/api/commands`);
    const studioCmd = commandsWithPathPlugin.commands.find((c) => c.name === "migration-studio");
    assert(Boolean(studioCmd), "migration-studio command should be present");
    assert(studioCmd?.canRun === true, "migration-studio should be runnable with loaded filesystem-path plugin");
    assert((studioCmd?.missingPlugins.length ?? 1) === 0, "migration-studio should not report missing plugins");
    log.output(`migration-studio: canRun=${studioCmd?.canRun} missingPlugins=${studioCmd?.missingPlugins.join(",")}`);

    // 5) services + UI endpoints payload shape
    log.info("validating /api/services shape includes service and ui inventories");
    const services = await requestJson<{
      services: Array<{ service: string; status: string }>;
      uis: { items: Array<{ id: string; url: string; reachable: boolean }> };
    }>(`${dashboard.baseUrl}/api/services`);
    assert(Array.isArray(services.services) && services.services.length > 0, "/api/services should include services[]");
    assert(Array.isArray(services.uis.items) && services.uis.items.length > 0, "/api/services should include uis.items[]");
    assert(services.uis.items.some((item) => item.id === "supabase-studio"), "uis.items should include supabase-studio");
    log.output(`services rows=${services.services.length} ui endpoints=${services.uis.items.length}`);
  } finally {
    await stopDashboard(dashboard);
  }
}
