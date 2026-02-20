/**
 * @sbtools/plugin-migration-studio
 *
 * Migration authoring UI: create migrations, analyze SQL, apply via core flow.
 * Uses CodeMirror 6, schema-aware autocomplete (Phase 2), live analysis (Phase 3).
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import readline from "node:readline";
import { execSync } from "node:child_process";
import type { DashboardView, SbtPlugin, PluginContext } from "@sbtools/sdk";
import { ui, hasFlag, getArg, loadPackageVersion, withHelp, readArtifactOrNull } from "@sbtools/sdk";
import { createRequestHandler } from "./server.js";
import { runIntrospect } from "./tools/introspect.js";
import { runSqlParse } from "./tools/sql-parse.js";
import { runAddColumn } from "./tools/generate-add-column.js";
import { runAddFunction } from "./tools/generate-add-function.js";
import { runCreateRpc } from "./tools/generate-create-rpc.js";
import { runCreateTable } from "./tools/generate-create-table.js";
import { runAddRlsPolicy } from "./tools/generate-add-rls-policy.js";
import { runAddIndex } from "./tools/generate-add-index.js";
import { runAddConstraint } from "./tools/generate-add-constraint.js";
import { runRlsCheck } from "./tools/rls-check.js";
import { runMigrationLint } from "./tools/migration-lint.js";
import { runRpcLint } from "./tools/rpc-lint.js";
import { runMigrationPlan } from "./tools/migration-plan.js";
import { runReleaseGate } from "./tools/release-gate.js";
import { runGreenfieldInit } from "./tools/greenfield-init.js";
import { runCreateView } from "./tools/generate-create-view.js";
import { runIntentPatch } from "./tools/intent-patch.js";
import { runEndpointMap } from "./tools/endpoint-map.js";
import { startWorkflow, resumeWorkflow, loadWorkflowRun } from "./engine/runner.js";
import { adoptBackendSteps, adoptBackendRegistry, ADOPT_BACKEND_WORKFLOW_ID } from "./workflows/adopt-backend.js";
import { STUDIO_ARTIFACTS } from "./artifacts/constants.js";
import type { IntentSyncData } from "./artifacts/writers.js";
import type { IntentGraph } from "@sbtools/sdk";

const DEFAULT_PORT = 3335;

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

const STUDIO_INTROSPECT_HELP = `
studio-introspect — Query live DB, write studio.schema.snapshot

Usage:
  sbt studio-introspect

Connects to the database and captures tables, policies, extensions.
`;

const STUDIO_SQL_PARSE_HELP = `
studio-sql-parse — Parse migration files, write studio.sql.ast

Usage:
  sbt studio-sql-parse

Scans supabase/migrations/ and extracts structured intent nodes.
`;

const STUDIO_ADOPT_HELP = `
studio-adopt — Run brownfield adoption workflow with checkpoints

Usage:
  sbt studio-adopt

Runs introspect → sql-parse → intent-sync (review) → intent-init (approve).
Pauses at each checkpoint for user review.
`;

const STUDIO_ADD_COLUMN_HELP = `
studio-add-column — Add column to intent-graph entity

Usage:
  sbt studio-add-column --entity <schema.table> --name <col> --type <type> [--nullable] [--default "''"]

Options:
  --entity   Entity ID (e.g. public.users)
  --name     Column name
  --type     PostgreSQL type
  --nullable Allow NULL (default: NOT NULL)
  --default  Default expression
`;

const STUDIO_ADD_FUNCTION_HELP = `
studio-add-function — Generate CREATE FUNCTION migration

Usage:
  sbt studio-add-function --schema public --name <name> --returns <type> --language plpgsql --body-file <path> [--security definer]

Options:
  --schema      Schema (default: public)
  --name        Function name
  --params      Params string, e.g. "user_id uuid"
  --returns     Return type
  --language    sql | plpgsql
  --body-file   Path to SQL file with function body
  --body        Inline body (single line)
  --security    invoker | definer (default: invoker)
`;

const STUDIO_CREATE_RPC_HELP = `
studio-create-rpc — Generate RPC function migration (schema: public)

Usage:
  sbt studio-create-rpc --name <name> --params "user_id uuid" --returns "TABLE(id uuid)" --language sql --body-file <path>

Same as studio-add-function but forces schema public for PostgREST.
`;

const STUDIO_CREATE_TABLE_HELP = `
studio-create-table — Generate CREATE TABLE migration

Usage:
  sbt studio-create-table --schema public --name <table> --columns "id uuid pk,email text,created_at timestamptz nullable" [--no-rls]

Options:
  --schema     Schema (default: public)
  --name       Table name (required)
  --columns    Column definitions: "name type [pk] [nullable] [default:expr] [identity]" comma-separated
  --no-rls     Skip ENABLE ROW LEVEL SECURITY (default: RLS enabled)

Column format examples:
  "id uuid pk identity"        → uuid PRIMARY KEY DEFAULT gen_random_uuid()
  "email text"                 → email text NOT NULL
  "bio text nullable"          → bio text
  "score int default:0"        → score int NOT NULL DEFAULT 0

Does not require an existing intent graph (safe for greenfield projects).
`;

const STUDIO_ADD_RLS_POLICY_HELP = `
studio-add-rls-policy — Generate CREATE POLICY migration

Usage:
  sbt studio-add-rls-policy --entity <schema.table> --name <policy_name> --command SELECT --roles authenticated [--using "auth.uid() = id"] [--with-check "..."] [--restrictive]

Options:
  --entity       Entity ID (e.g. public.users)
  --name         Policy name
  --command      SELECT | INSERT | UPDATE | DELETE | ALL
  --roles        Comma-separated role names (e.g. authenticated,service_role)
  --using        USING expression
  --with-check   WITH CHECK expression
  --restrictive  Use AS RESTRICTIVE (default: PERMISSIVE)
`;

const STUDIO_ADD_INDEX_HELP = `
studio-add-index — Generate CREATE INDEX migration

Usage:
  sbt studio-add-index --entity <schema.table> --columns <col1,col2> [--unique] [--method btree] [--name <idx_name>] [--where "expr"]

Options:
  --entity     Entity ID (e.g. public.users)
  --columns    Comma-separated column names
  --unique     Create UNIQUE INDEX
  --method     btree | hash | gin | gist | brin (default: btree)
  --name       Index name (auto-generated if omitted)
  --where      Partial index predicate
`;

const STUDIO_ADD_CONSTRAINT_HELP = `
studio-add-constraint — Generate ALTER TABLE ADD CONSTRAINT migration

Usage:
  sbt studio-add-constraint --entity <schema.table> --name <constraint_name> --type <fk|unique|check> [options]

Foreign key options:
  --type fk --columns <col> --ref-table <schema.table> --ref-columns <col> [--on-delete CASCADE] [--on-update SET NULL]

Unique options:
  --type unique --columns <col1,col2>

Check options:
  --type check --check "price > 0"
`;

const STUDIO_GREENFIELD_INIT_HELP = `
studio-greenfield-init — Create an empty intent graph for greenfield (no-DB) projects

Usage:
  sbt studio-greenfield-init

Creates a studio.intent.graph artifact with mode: 'greenfield' and no entities.
Use studio-create-table, studio-add-rls-policy, etc. to populate it.
Run studio-lint and studio-release-gate before applying migrations.
`;

const STUDIO_RLS_CHECK_HELP = `
studio-rls-check — Analyze RLS coverage across all managed entities

Usage:
  sbt studio-rls-check

Reads:  studio.intent.graph
Writes: studio.rls.plan, studio.rls.report
`;

const STUDIO_LINT_HELP = `
studio-lint — Lint migration files for risky patterns

Usage:
  sbt studio-lint

Reads:  studio.sql.ast
Writes: studio.migration.lint
`;

const STUDIO_RPC_LINT_HELP = `
studio-rpc-lint — Lint RPC/function definitions for security issues

Usage:
  sbt studio-rpc-lint

Reads:  studio.intent.graph
Writes: studio.rpc.plan
`;

const STUDIO_MIGRATION_PLAN_HELP = `
studio-migration-plan — Diff intent graph vs DB snapshot and produce a change plan

Usage:
  sbt studio-migration-plan

Reads:  studio.intent.graph, studio.schema.snapshot
Writes: studio.migration.plan
`;

const STUDIO_RELEASE_GATE_HELP = `
studio-release-gate — Aggregate validation results and produce a go/no-go gate

Usage:
  sbt studio-release-gate

Reads:  studio.rls.report, studio.rpc.plan, studio.migration.lint (all optional)
Writes: studio.release.gate
`;

const STUDIO_CREATE_VIEW_HELP = `
studio-create-view — Generate CREATE OR REPLACE VIEW migration

Usage:
  sbt studio-create-view --schema public --name <view_name> --query "SELECT ..."

Options:
  --schema   Schema (default: public)
  --name     View name (required)
  --query    SELECT query body (required)

Does not require an existing intent graph.
`;

const STUDIO_INTENT_PATCH_HELP = `
studio-intent-patch — Patch a single entity's classification in the intent graph

Usage:
  sbt studio-intent-patch --entity <schema.table> --action <exclude|set-status> [--status <managed|assisted|opaque>]

Options:
  --entity    Entity ID (e.g. public.users)
  --action    exclude | set-status
  --status    managed | assisted | opaque (required for set-status)

Examples:
  sbt studio-intent-patch --entity public.logs --action exclude
  sbt studio-intent-patch --entity public.orders --action set-status --status managed
`;

const STUDIO_ENDPOINT_MAP_HELP = `
studio-endpoint-map — Derive PostgREST/RPC endpoint declarations from the intent graph

Usage:
  sbt studio-endpoint-map

Reads:  studio.intent.graph
Writes: studio.intent.graph (endpoint declarations added in-place)

Produces table-crud endpoints for managed entities and rpc endpoints for managed
public-schema functions. No database connection required.
`;

async function migrationStudioCommand(args: string[], ctx: PluginContext): Promise<void> {
  const port = parseInt(getArg(args, "--port") ?? String(DEFAULT_PORT), 10) || DEFAULT_PORT;
  const doRestart = hasFlag(args, "--restart");

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

async function studioIntrospectCommand(_args: string[], ctx: PluginContext): Promise<void> {
  ui.detail("Connecting to postgresql://...");
  await runIntrospect(ctx);
  const env = readArtifactOrNull(
    ctx,
    STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id,
    STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.version
  );
  const data = env?.data as { entities?: unknown[]; policies?: unknown[]; infrastructure?: unknown[] } | undefined;
  const entities = data?.entities?.length ?? 0;
  const policies = data?.policies?.length ?? 0;
  const infra = data?.infrastructure?.length ?? 0;
  ui.success(`Captured ${entities} tables, ${policies} policies, ${infra} extensions`);
  ui.detail(`Written to .sbt/artifacts/${STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id}/1.0.0/latest.json`);
}

async function studioSqlParseCommand(_args: string[], ctx: PluginContext): Promise<void> {
  const migrationsDir = ctx.paths?.migrations ?? path.join(ctx.projectRoot, "supabase", "migrations");
  let fileCount = 0;
  if (fs.existsSync(migrationsDir)) {
    fileCount = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).length;
  }
  ui.detail(`Scanning supabase/migrations/ (${fileCount} files)...`);
  await runSqlParse(ctx);
  const env = readArtifactOrNull(ctx, STUDIO_ARTIFACTS.SQL_AST.id, STUDIO_ARTIFACTS.SQL_AST.version);
  const data = env?.data as { files?: unknown[]; totalStatements?: number; totalOpaqueBlocks?: number } | undefined;
  const stmts = data?.totalStatements ?? 0;
  const opaque = data?.totalOpaqueBlocks ?? 0;
  ui.success(`Parsed ${stmts} statements, ${opaque} opaque blocks`);
  ui.detail(`Written to .sbt/artifacts/${STUDIO_ARTIFACTS.SQL_AST.id}/1.0.0/latest.json`);
}

async function studioAdoptCommand(_args: string[], ctx: PluginContext): Promise<void> {
  let run = loadWorkflowRun(ctx);
  if (!run) {
    run = await startWorkflow(ADOPT_BACKEND_WORKFLOW_ID, adoptBackendSteps, ctx, adoptBackendRegistry);
  }
  while (run.status === "waiting_checkpoint") {
    for (let i = 0; i < run.steps.length; i++) {
      const step = adoptBackendSteps[i];
      const result = run.steps[i];
      const sym = result?.status === "completed" ? "✓" : result?.status === "failed" ? "✗" : " ";
      ui.detail(`Step ${i + 1}/4: ${step.id.padEnd(12)} ${sym} ${result?.status ?? "pending"}`);
    }
    const lastCompleted = adoptBackendSteps[run.currentStep - 1];
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
    run = await resumeWorkflow(run, adoptBackendSteps, ctx, adoptBackendRegistry);
  }
  for (let i = 0; i < adoptBackendSteps.length; i++) {
    const step = adoptBackendSteps[i];
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

async function studioAddColumnCommand(args: string[], ctx: PluginContext): Promise<void> {
  const entity = getArg(args, "--entity");
  const name = getArg(args, "--name");
  const typeArg = getArg(args, "--type");
  if (!entity || !name || !typeArg) {
    throw new Error("--entity, --name, and --type are required");
  }
  const nullable = hasFlag(args, "--nullable");
  const defaultVal = getArg(args, "--default");
  const result = await runAddColumn(ctx, {
    entityId: entity,
    column: { name, type: typeArg, nullable, default: defaultVal },
  });
  ui.success(`Written ${result.filename}`);
}

async function studioAddFunctionCommand(args: string[], ctx: PluginContext): Promise<void> {
  const schema = getArg(args, "--schema") ?? "public";
  const name = getArg(args, "--name");
  const paramsStr = getArg(args, "--params");
  const returns = getArg(args, "--returns");
  const language = (getArg(args, "--language") ?? "plpgsql") as "sql" | "plpgsql";
  const bodyFile = getArg(args, "--body-file");
  const bodyInline = getArg(args, "--body");
  const security = getArg(args, "--security") === "definer" ? "definer" : "invoker";
  if (!name || !returns) throw new Error("--name and --returns are required");
  let body: string;
  if (bodyFile) {
    const fs = await import("node:fs");
    const p = await import("node:path");
    body = fs.readFileSync(p.resolve(ctx.projectRoot, bodyFile), "utf8");
  } else if (bodyInline) {
    body = bodyInline;
  } else {
    throw new Error("--body-file or --body required");
  }
  const params: Array<{ name: string; type: string }> = [];
  if (paramsStr) {
    for (const part of paramsStr.split(",").map((s) => s.trim())) {
      const [n, t] = part.split(/\s+/);
      if (n && t) params.push({ name: n, type: t });
    }
  }
  const result = await runAddFunction(ctx, {
    schema,
    name,
    params,
    returnType: returns,
    language,
    body,
    security,
  });
  ui.success(`Written ${result.filename}`);
}

async function studioCreateRpcCommand(args: string[], ctx: PluginContext): Promise<void> {
  const name = getArg(args, "--name");
  const paramsStr = getArg(args, "--params");
  const returns = getArg(args, "--returns");
  const language = (getArg(args, "--language") ?? "sql") as "sql" | "plpgsql";
  const bodyFile = getArg(args, "--body-file");
  const bodyInline = getArg(args, "--body");
  if (!name || !returns) throw new Error("--name and --returns are required");
  let body: string;
  if (bodyFile) {
    const fs = await import("node:fs");
    const p = await import("node:path");
    body = fs.readFileSync(p.resolve(ctx.projectRoot, bodyFile), "utf8");
  } else if (bodyInline) {
    body = bodyInline;
  } else {
    throw new Error("--body-file or --body required");
  }
  const params: Array<{ name: string; type: string }> = [];
  if (paramsStr) {
    for (const part of paramsStr.split(",").map((s) => s.trim())) {
      const [n, t] = part.split(/\s+/);
      if (n && t) params.push({ name: n, type: t });
    }
  }
  const result = await runCreateRpc(ctx, {
    name,
    params,
    returnType: returns,
    language,
    body,
  });
  ui.success(`Written ${result.filename}`);
}

async function studioCreateTableCommand(args: string[], ctx: PluginContext): Promise<void> {
  const schema = getArg(args, "--schema") ?? "public";
  const name = getArg(args, "--name");
  const columnsStr = getArg(args, "--columns");
  const noRls = hasFlag(args, "--no-rls");
  if (!name) throw new Error("--name is required");

  const columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    default?: string;
    identity?: boolean;
    primaryKey?: boolean;
  }> = [];

  if (columnsStr) {
    for (const part of columnsStr.split(",").map((s) => s.trim())) {
      const tokens = part.split(/\s+/);
      const colName = tokens[0];
      const colType = tokens[1];
      if (!colName || !colType) continue;
      const flags = tokens.slice(2);
      const defaultToken = flags.find((f) => f.startsWith("default:"));
      columns.push({
        name: colName,
        type: colType,
        nullable: flags.includes("nullable"),
        default: defaultToken ? defaultToken.slice("default:".length) : undefined,
        identity: flags.includes("identity"),
        primaryKey: flags.includes("pk"),
      });
    }
  }

  const result = await runCreateTable(ctx, { schema, name, columns, enableRls: !noRls });
  ui.success(`Written ${result.filename}`);
}

async function studioAddRlsPolicyCommand(args: string[], ctx: PluginContext): Promise<void> {
  const entity = getArg(args, "--entity");
  const policyName = getArg(args, "--name");
  const command = getArg(args, "--command") as "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "ALL";
  const rolesStr = getArg(args, "--roles");
  const using = getArg(args, "--using");
  const withCheck = getArg(args, "--with-check");
  const restrictive = hasFlag(args, "--restrictive");

  if (!entity || !policyName || !command || !rolesStr) {
    throw new Error("--entity, --name, --command, and --roles are required");
  }

  const roles = rolesStr.split(",").map((r) => r.trim()).filter(Boolean);
  const result = await runAddRlsPolicy(ctx, {
    entityId: entity,
    policy: { name: policyName, command, roles, using, withCheck, permissive: !restrictive },
  });
  ui.success(`Written ${result.filename}`);
}

async function studioAddIndexCommand(args: string[], ctx: PluginContext): Promise<void> {
  const entity = getArg(args, "--entity");
  const columnsStr = getArg(args, "--columns");
  const indexName = getArg(args, "--name");
  const method = (getArg(args, "--method") ?? "btree") as "btree" | "hash" | "gin" | "gist" | "brin";
  const where = getArg(args, "--where");
  const unique = hasFlag(args, "--unique");

  if (!entity || !columnsStr) throw new Error("--entity and --columns are required");

  const columns = columnsStr.split(",").map((c) => c.trim()).filter(Boolean);
  const result = await runAddIndex(ctx, {
    entityId: entity,
    index: { name: indexName ?? undefined, columns, unique, method, where },
  });
  ui.success(`Written ${result.filename}`);
}

async function studioAddConstraintCommand(args: string[], ctx: PluginContext): Promise<void> {
  const entity = getArg(args, "--entity");
  const constraintName = getArg(args, "--name");
  const type = getArg(args, "--type") as "foreign_key" | "unique" | "check";
  const columnsStr = getArg(args, "--columns");
  const refTableStr = getArg(args, "--ref-table");
  const refColumnsStr = getArg(args, "--ref-columns");
  const onDelete = getArg(args, "--on-delete") as "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION" | "SET DEFAULT" | undefined;
  const onUpdate = getArg(args, "--on-update") as "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION" | "SET DEFAULT" | undefined;
  const check = getArg(args, "--check");

  if (!entity || !constraintName || !type) {
    throw new Error("--entity, --name, and --type are required");
  }

  const columns = columnsStr ? columnsStr.split(",").map((c) => c.trim()).filter(Boolean) : undefined;

  let references: { schema: string; table: string; columns: string[]; onDelete?: typeof onDelete; onUpdate?: typeof onUpdate } | undefined;
  if (type === "foreign_key" && refTableStr) {
    const refParts = refTableStr.split(".");
    const refSchema = refParts.length >= 2 ? refParts[0] : "public";
    const refTable = refParts.length >= 2 ? (refParts[1] ?? refParts[0]) : refParts[0] ?? refTableStr;
    const refCols = refColumnsStr ? refColumnsStr.split(",").map((c) => c.trim()).filter(Boolean) : ["id"];
    references = { schema: refSchema, table: refTable, columns: refCols, onDelete, onUpdate };
  }

  const result = await runAddConstraint(ctx, {
    entityId: entity,
    constraint: { name: constraintName, type, columns, references, check },
  });
  ui.success(`Written ${result.filename}`);
}

async function studioGreenfieldInitCommand(_args: string[], ctx: PluginContext): Promise<void> {
  const graph = await runGreenfieldInit(ctx);
  ui.success(`Greenfield intent graph created (mode: ${graph.mode}, 0 entities)`);
  ui.detail(`Written to .sbt/artifacts/${STUDIO_ARTIFACTS.INTENT_GRAPH.id}/1.0.0/latest.json`);
  ui.detail(`Next: use studio-create-table, studio-add-rls-policy, etc. to build your schema.`);
}

async function studioRlsCheckCommand(_args: string[], ctx: PluginContext): Promise<void> {
  const { report } = await runRlsCheck(ctx);
  if (report.status === "pass") {
    ui.success(`RLS check passed — ${report.entitiesChecked} entities checked, ${report.tablesWithRls} with RLS`);
  } else {
    ui.detail(`RLS check failed — ${report.gaps.length} gap(s) found:`);
    for (const gap of report.gaps) {
      ui.detail(`  ${gap.entityId}: missing ${gap.missingCommands.join(", ")}`);
    }
    throw new Error("RLS gaps detected");
  }
  if (report.warnings.length > 0) {
    for (const w of report.warnings) {
      ui.detail(`  Warning [${w.code}]: ${w.message}`);
    }
  }
}

async function studioLintCommand(_args: string[], ctx: PluginContext): Promise<void> {
  const result = await runMigrationLint(ctx);
  if (result.status === "pass") {
    ui.success(`Migration lint passed — ${result.findings.length} finding(s)`);
  } else {
    ui.detail(`Migration lint failed — ${result.errorCount} error(s), ${result.warningCount} warning(s):`);
    for (const f of result.findings) {
      ui.detail(`  [${f.severity.toUpperCase()}] ${f.code}: ${f.message}`);
    }
    throw new Error("Migration lint errors detected");
  }
}

async function studioRpcLintCommand(_args: string[], ctx: PluginContext): Promise<void> {
  const result = await runRpcLint(ctx);
  const withWarnings = result.functions.filter((f) => f.lintWarnings.length > 0);
  if (withWarnings.length === 0) {
    ui.success(`RPC lint passed — ${result.functions.length} function(s) checked, no issues`);
  } else {
    ui.detail(`RPC lint — ${result.securityDefinerCount} SECURITY DEFINER, ${result.missingSearchPathCount} missing search_path:`);
    for (const f of withWarnings) {
      ui.detail(`  ${f.functionId}: ${f.lintWarnings.join("; ")}`);
    }
  }
}

async function studioMigrationPlanCommand(_args: string[], ctx: PluginContext): Promise<void> {
  const result = await runMigrationPlan(ctx);
  ui.success(`Migration plan: ${result.totalChanges} change(s), ${result.destructiveCount} destructive`);
  for (const c of result.changes) {
    const prefix = c.requiresConfirmation ? "⚠" : "·";
    ui.detail(`  ${prefix} [${c.changeClass}] ${c.objectId}`);
  }
}

async function studioReleaseGateCommand(_args: string[], ctx: PluginContext): Promise<void> {
  const gate = await runReleaseGate(ctx);
  if (gate.status === "pass") {
    ui.success(`Release gate: PASS — ${gate.evidence.length} evidence artifact(s), ${gate.warnings.length} warning(s)`);
    for (const w of gate.warnings) {
      ui.detail(`  Warning [${w.code}]: ${w.message}`);
    }
  } else {
    ui.detail(`Release gate: FAIL — ${gate.blocking.length} blocking issue(s):`);
    for (const b of gate.blocking) {
      ui.detail(`  [${b.severity.toUpperCase()}] ${b.code}: ${b.message}`);
    }
    throw new Error("Release gate failed");
  }
}

async function studioCreateViewCommand(args: string[], ctx: PluginContext): Promise<void> {
  const schema = getArg(args, "--schema") ?? "public";
  const name = getArg(args, "--name");
  const query = getArg(args, "--query");
  if (!name || !query) throw new Error("--name and --query are required");
  const result = await runCreateView(ctx, { schema, name, query });
  ui.success(`Written ${result.filename}`);
}

async function studioIntentPatchCommand(args: string[], ctx: PluginContext): Promise<void> {
  const entity = getArg(args, "--entity");
  const action = getArg(args, "--action") as "exclude" | "set-status" | undefined;
  const status = getArg(args, "--status") as "managed" | "assisted" | "opaque" | undefined;

  if (!entity || !action) throw new Error("--entity and --action are required");
  if (action !== "exclude" && action !== "set-status") throw new Error("--action must be exclude or set-status");

  const result = await runIntentPatch(ctx, { entityId: entity, action, status });
  ui.success(`Patched ${result.entityId}: ${result.previousStatus} → ${result.newStatus}`);
  ui.detail(`Excluded count: ${result.excludedCount} / ${result.totalEntities} total entities`);
}

async function studioEndpointMapCommand(_args: string[], ctx: PluginContext): Promise<void> {
  const result = await runEndpointMap(ctx);
  ui.success(`Endpoint map: ${result.total} endpoint(s) derived`);
  ui.detail(`  table-crud: ${result.entityEndpoints}  rpc: ${result.rpcEndpoints}`);
  ui.detail(`Written to .sbt/artifacts/${STUDIO_ARTIFACTS.INTENT_GRAPH.id}/1.0.0/latest.json`);
}

async function getAtlasData(ctx: PluginContext): Promise<import("@sbtools/sdk").PluginAtlasData> {
  const graph = readArtifactOrNull<IntentGraph>(
    ctx,
    STUDIO_ARTIFACTS.INTENT_GRAPH.id,
    STUDIO_ARTIFACTS.INTENT_GRAPH.version
  );
  if (!graph?.data) {
    return { categories: {}, stats: [] };
  }
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
    { name: "studio-introspect", description: "Query DB → studio.schema.snapshot", run: withHelp(STUDIO_INTROSPECT_HELP, studioIntrospectCommand) },
    { name: "studio-sql-parse", description: "Parse migrations → studio.sql.ast", run: withHelp(STUDIO_SQL_PARSE_HELP, studioSqlParseCommand) },
    { name: "studio-adopt", description: "Brownfield adoption workflow with checkpoints", run: withHelp(STUDIO_ADOPT_HELP, studioAdoptCommand) },
    { name: "studio-add-column", description: "Add column to intent-graph entity", run: withHelp(STUDIO_ADD_COLUMN_HELP, studioAddColumnCommand) },
    { name: "studio-add-function", description: "Generate CREATE FUNCTION migration", run: withHelp(STUDIO_ADD_FUNCTION_HELP, studioAddFunctionCommand) },
    { name: "studio-create-rpc", description: "Generate RPC migration (schema: public)", run: withHelp(STUDIO_CREATE_RPC_HELP, studioCreateRpcCommand) },
    { name: "studio-create-table", description: "Generate CREATE TABLE migration", run: withHelp(STUDIO_CREATE_TABLE_HELP, studioCreateTableCommand) },
    { name: "studio-add-rls-policy", description: "Generate CREATE POLICY migration", run: withHelp(STUDIO_ADD_RLS_POLICY_HELP, studioAddRlsPolicyCommand) },
    { name: "studio-add-index", description: "Generate CREATE INDEX migration", run: withHelp(STUDIO_ADD_INDEX_HELP, studioAddIndexCommand) },
    { name: "studio-add-constraint", description: "Generate ALTER TABLE ADD CONSTRAINT migration", run: withHelp(STUDIO_ADD_CONSTRAINT_HELP, studioAddConstraintCommand) },
    { name: "studio-greenfield-init", description: "Create empty intent graph for greenfield projects", run: withHelp(STUDIO_GREENFIELD_INIT_HELP, studioGreenfieldInitCommand) },
    { name: "studio-rls-check", description: "Analyze RLS coverage for managed entities", run: withHelp(STUDIO_RLS_CHECK_HELP, studioRlsCheckCommand) },
    { name: "studio-lint", description: "Lint migration files for risky patterns", run: withHelp(STUDIO_LINT_HELP, studioLintCommand) },
    { name: "studio-rpc-lint", description: "Lint RPC/function definitions for security issues", run: withHelp(STUDIO_RPC_LINT_HELP, studioRpcLintCommand) },
    { name: "studio-migration-plan", description: "Diff intent graph vs snapshot → migration plan", run: withHelp(STUDIO_MIGRATION_PLAN_HELP, studioMigrationPlanCommand) },
    { name: "studio-release-gate", description: "Aggregate validation → go/no-go gate", run: withHelp(STUDIO_RELEASE_GATE_HELP, studioReleaseGateCommand) },
    { name: "studio-create-view", description: "Generate CREATE OR REPLACE VIEW migration", run: withHelp(STUDIO_CREATE_VIEW_HELP, studioCreateViewCommand) },
    { name: "studio-intent-patch", description: "Patch entity classification in intent graph", run: withHelp(STUDIO_INTENT_PATCH_HELP, studioIntentPatchCommand) },
    { name: "studio-endpoint-map", description: "Derive endpoint declarations from intent graph", run: withHelp(STUDIO_ENDPOINT_MAP_HELP, studioEndpointMapCommand) },
  ],
  getAtlasData,
  getDashboardView: getMigrationStudioDashboardView,
};

export default plugin;
