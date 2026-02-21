import http from "node:http";
import readline from "node:readline";
import { execSync } from "node:child_process";
import type { DashboardView, PluginContext, SbtPlugin } from "@sbtools/sdk";
import { loadPackageVersion, readArtifactOrNull, ui, withHelp } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "./artifacts/constants.js";
import type { IntentSyncData } from "./artifacts/writers.js";
import type { IntentGraph } from "@sbtools/sdk";
import { startWorkflow, resumeWorkflow, loadWorkflowRun } from "./engine/runner.js";
import { createRequestHandler } from "./server.js";
import { STUDIO_TOOLS } from "./tools/discovery.js";
import { STUDIO_WORKFLOWS_BY_ID } from "./workflows/discovery.js";
import { ADOPT_BACKEND_WORKFLOW_ID } from "./workflows/adopt-backend.workflow.js";
import { getCatalog, parseCatalogFilters } from "./catalog.js";

const DEFAULT_PORT = 3335;
const MIGRATION_STUDIO_HELP = `
migration-studio — Migration authoring UI

Usage:
  sbt migration-studio              Start the studio server (default port 3335)
  sbt migration-studio --port N     Use port N
  sbt migration-studio --restart    Kill existing server on port, then start

Options:
  -h, --help    Show this help
  --port N      HTTP server port (default: 3335)
  --restart     Kill process using the port before starting (cross-platform)
`;

const STUDIO_ADOPT_HELP = `
studio-adopt — Run brownfield adoption workflow with checkpoints

Usage:
  sbt studio-adopt
`;

const STUDIO_CATALOG_HELP = `
studio-catalog — List tools/workflows with optional audience/mode filters

Usage:
  sbt studio-catalog [--audience backend-dev|business|mixed] [--mode managed|assisted|loose] [--type tools|workflows|all]
`;

function promptUser(message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
    rl.on("SIGINT", () => {
      rl.close();
      reject(new Error("Aborted"));
    });
  });
}

function printSyncReport(ctx: PluginContext): void {
  const env = readArtifactOrNull<IntentSyncData>(
    ctx,
    STUDIO_ARTIFACTS.INTENT_SYNC.id,
    STUDIO_ARTIFACTS.INTENT_SYNC.version
  );
  if (!env?.data) return;
  const data = env.data;
  const status = (c: number) => (c >= 0.8 ? "managed" : c >= 0.5 ? "assisted" : "opaque");
  ui.detail("── Review: Confidence Report ──────────────────────────────");
  for (const m of data.matched.filter((x) => x.objectType === "entity")) {
    const note = m.driftDetails ?? "(matched DB + SQL)";
    ui.detail(`  ${m.objectId.padEnd(24)} ${m.confidence.toFixed(2)}  ${status(m.confidence).padEnd(8)} ${note}`);
  }
  for (const u of data.unmatchedDb.filter((x) => x.objectType === "entity")) {
    ui.detail(`  ${u.objectId.padEnd(24)} 0.35  opaque     (no migration found)`);
  }
  ui.detail("───────────────────────────────────────────────────────────");
}

function printManagedScope(ctx: PluginContext): void {
  const env = readArtifactOrNull<IntentGraph>(
    ctx,
    STUDIO_ARTIFACTS.INTENT_GRAPH.id,
    STUDIO_ARTIFACTS.INTENT_GRAPH.version
  );
  if (!env?.data) return;
  const entities = env.data.entities;
  const managed = entities.filter((e) => e.managedStatus === "managed").length;
  const assisted = entities.filter((e) => e.managedStatus === "assisted").length;
  const opaque = env.data.opaqueBlocks.filter((b) => b.id.startsWith("entity:")).length;
  ui.detail("── Approve: Managed Scope ──────────────────────────────────");
  ui.detail(`  ${managed} managed · ${assisted} assisted · ${opaque} opaque`);
  ui.detail("───────────────────────────────────────────────────────────");
}

function getMigrationStudioDashboardView(): DashboardView {
  return {
    sections: [
      {
        id: "migration_studio",
        title: "Migration Studio",
        description: "Interactive migration authoring server connected from the dashboard UI.",
        dataKey: "migration_studio",
        layout: "summary-only",
      },
      {
        id: "studio_intent_entities",
        title: "Intent Graph",
        description: "Managed, assisted, and opaque entities from the brownfield adoption scan.",
        dataKey: "studio_intent_entities",
        layout: "table",
        table: {
          columns: [
            { header: "Entity", field: "id" },
            { header: "Schema", field: "schema" },
            { header: "Status", field: "managedStatus" },
            { header: "Confidence", field: "confidence", format: "number" },
          ],
        },
      },
    ],
  };
}

function killProcessOnPort(port: number): boolean {
  try {
    if (process.platform === "win32") {
      execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
        { stdio: "ignore", windowsHide: true }
      );
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || fuser -k ${port}/tcp 2>/dev/null || true`, {
        stdio: "ignore",
      });
    }
    return true;
  } catch {
    return false;
  }
}

async function migrationStudioCommand(args: string[], ctx: PluginContext): Promise<void> {
  const portArg = args.find((a) => a === "--port");
  const idx = portArg ? args.indexOf(portArg) : -1;
  const port = idx >= 0 ? Number.parseInt(args[idx + 1] ?? "", 10) || DEFAULT_PORT : DEFAULT_PORT;
  const doRestart = args.includes("--restart");

  if (doRestart) {
    killProcessOnPort(port);
    await new Promise((r) => setTimeout(r, 500));
  }

  const handler = createRequestHandler(ctx);
  const server = http.createServer(handler);

  function shutdown() {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 2000);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  function tryListen() {
    server.listen(port, () => {
      ui.success(`Migration Studio at http://localhost:${port}`);
      ui.detail("Press Ctrl+C to stop.");
    });
  }

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      ui.detail(`Port ${port} in use; killing existing process...`);
      killProcessOnPort(port);
      setTimeout(tryListen, 500);
    } else {
      throw err;
    }
  });

  tryListen();
}

function buildWorkflowRegistry(workflowId: string): Record<string, (ctx: PluginContext) => Promise<void>> {
  const workflow = STUDIO_WORKFLOWS_BY_ID.get(workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
  const needed = new Set(workflow.steps.map((s) => s.tool));
  const entries = STUDIO_TOOLS
    .filter((t) => needed.has(t.id))
    .map((t) => [
      t.id,
      async (ctx: PluginContext) => {
        await t.run(ctx, undefined);
      },
    ] as const);
  return Object.fromEntries(entries);
}

async function studioAdoptCommand(_args: string[], ctx: PluginContext): Promise<void> {
  const workflow = STUDIO_WORKFLOWS_BY_ID.get(ADOPT_BACKEND_WORKFLOW_ID);
  if (!workflow) throw new Error(`Workflow not found: ${ADOPT_BACKEND_WORKFLOW_ID}`);

  let run = loadWorkflowRun(ctx);
  if (!run) {
    run = await startWorkflow(workflow.id, workflow.steps, ctx, buildWorkflowRegistry(workflow.id));
  }
  while (run.status === "waiting_checkpoint") {
    for (let i = 0; i < run.steps.length; i++) {
      const step = workflow.steps[i];
      const result = run.steps[i];
      const sym = result?.status === "completed" ? "✓" : result?.status === "failed" ? "✗" : " ";
      ui.detail(`Step ${i + 1}/4: ${step.id.padEnd(12)} ${sym} ${result?.status ?? "pending"}`);
    }
    const lastCompleted = workflow.steps[run.currentStep - 1];
    const cp = lastCompleted?.checkpoint;
    if (cp === "review") {
      printSyncReport(ctx);
      await promptUser("Press ENTER to continue or Ctrl+C to abort:\n");
    } else if (cp === "approve") {
      printManagedScope(ctx);
      await promptUser("Press ENTER to build intent graph or Ctrl+C to abort:\n");
    } else {
      await promptUser("Press ENTER to continue or Ctrl+C to abort:\n");
    }
    run = await resumeWorkflow(run, workflow.steps, ctx, buildWorkflowRegistry(workflow.id));
  }

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    const result = run.steps[i];
    const sym = result?.status === "completed" ? "✓" : result?.status === "failed" ? "✗" : "–";
    ui.detail(`Step ${i + 1}/4: ${step.id.padEnd(12)} ${sym} ${result?.status ?? "pending"}`);
  }

  if (run.status === "completed") {
    ui.success(`Intent graph written to .sbt/artifacts/${STUDIO_ARTIFACTS.INTENT_GRAPH.id}/1.0.0/latest.json`);
  } else if (run.status === "failed") {
    const last = run.steps[run.steps.length - 1];
    throw new Error(last?.error ?? "Workflow failed");
  }
}

async function studioCatalogCommand(args: string[], _ctx: PluginContext): Promise<void> {
  const arg = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const filters = parseCatalogFilters({
    audience: arg("--audience"),
    mode: arg("--mode"),
    type: arg("--type"),
  });
  const catalog = getCatalog(filters);
  ui.detail("Tools:");
  if (catalog.tools.length === 0) ui.detail("  (none)");
  for (const t of catalog.tools) {
    const aliases = t.aliases?.length ? ` aliases=${t.aliases.join(",")}` : "";
    const aud = t.audience ?? "unspecified";
    const modes = t.controlModes.join(",") || "unspecified";
    ui.detail(`  ${t.id} command=${t.command ?? "-"} audience=${aud} modes=${modes}${aliases}`);
  }
  ui.detail("Workflows:");
  if (catalog.workflows.length === 0) ui.detail("  (none)");
  for (const w of catalog.workflows) {
    ui.detail(`  ${w.id} steps=${w.steps.join(" -> ")} audience=${w.inferredAudiences.join(",")} modes=${w.inferredControlModes.join(",")}`);
  }
}

async function getAtlasData(ctx: PluginContext): Promise<import("@sbtools/sdk").PluginAtlasData> {
  const graph = readArtifactOrNull<IntentGraph>(
    ctx,
    STUDIO_ARTIFACTS.INTENT_GRAPH.id,
    STUDIO_ARTIFACTS.INTENT_GRAPH.version
  );
  if (!graph?.data) return { categories: {}, stats: [] };
  const entities = graph.data.entities.map((e) => ({
    id: e.id,
    schema: e.schema,
    name: e.name,
    managedStatus: e.managedStatus,
    confidence: e.confidence,
  }));
  return {
    categories: { studio_intent_entities: entities },
    stats: [{ label: "Intent Entities", value: entities.length }],
  };
}

function buildToolCommands(): import("@sbtools/sdk").SbtPluginCommand[] {
  const commands: import("@sbtools/sdk").SbtPluginCommand[] = [];
  const seen = new Set<string>();
  for (const tool of STUDIO_TOOLS.filter((t) => t.cli)) {
    const cli = tool.cli!;
    const names = [cli.command, ...(cli.aliases ?? [])];
    for (const name of names) {
      if (seen.has(name)) continue;
      seen.add(name);
      commands.push({
        name,
        description: cli.description,
        run: withHelp(cli.help, async (args, ctx) => {
          const input = await cli.parseArgs(args, ctx);
          const result = await tool.run(ctx, input);
          if (cli.onSuccess) await cli.onSuccess(result, ctx);
        }),
      });
    }
  }
  return commands;
}

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-migration-studio",
  version: loadPackageVersion(import.meta.url),
  artifactCapabilities: {
    produces: [
      "migration.studio.draft",
      STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id,
      STUDIO_ARTIFACTS.SQL_AST.id,
      STUDIO_ARTIFACTS.INTENT_SYNC.id,
      STUDIO_ARTIFACTS.INTENT_GRAPH.id,
      STUDIO_ARTIFACTS.WORKFLOW_RUN.id,
      STUDIO_ARTIFACTS.RLS_PLAN.id,
      STUDIO_ARTIFACTS.RLS_REPORT.id,
      STUDIO_ARTIFACTS.MIGRATION_LINT.id,
      STUDIO_ARTIFACTS.RPC_PLAN.id,
      STUDIO_ARTIFACTS.MIGRATION_PLAN.id,
      STUDIO_ARTIFACTS.RELEASE_GATE.id,
      STUDIO_ARTIFACTS.APPLY_LOG.id,
    ],
    consumes: ["migration.analysis"],
  },
  commands: [
    {
      name: "migration-studio",
      description: "Migration authoring UI — create migrations, analyze SQL, apply via sbt migrate",
      run: withHelp(MIGRATION_STUDIO_HELP, migrationStudioCommand),
    },
    {
      name: "studio-adopt",
      description: "Brownfield adoption workflow with checkpoints",
      run: withHelp(STUDIO_ADOPT_HELP, studioAdoptCommand),
    },
    {
      name: "studio-catalog",
      description: "List discovered tools/workflows with audience/mode filters",
      run: withHelp(STUDIO_CATALOG_HELP, studioCatalogCommand),
    },
    ...buildToolCommands(),
  ],
  getAtlasData,
  getDashboardView: getMigrationStudioDashboardView,
};

export default plugin;
