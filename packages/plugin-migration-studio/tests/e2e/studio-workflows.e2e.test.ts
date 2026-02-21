import type { PluginContext, WorkflowRun } from "@sbtools/sdk";
import type { IntentGraph } from "@sbtools/sdk";
import { describe, expect, it } from "vitest";
import { readArtifactOrNull, writeArtifact } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../../src/artifacts/constants.js";
import type { ToolRegistry } from "../../src/engine/runner.js";
import { resumeWorkflow, startWorkflow } from "../../src/engine/runner.js";
import { STUDIO_TOOLS_BY_ID } from "../../src/tools/discovery.js";
import type { CreateTableInput } from "../../src/tools/core/studio-create-table.core.js";
import type { AddRlsPolicyInput } from "../../src/tools/core/studio-add-rls-policy.core.js";
import { runGreenfieldInit } from "../../src/tools/core/studio-greenfield-init.core.js";
import { runSqlParse } from "../../src/tools/core/studio-sql-parse.core.js";
import { STUDIO_WORKFLOWS, STUDIO_WORKFLOWS_BY_ID } from "../../src/workflows/discovery.js";
import {
  cleanupTempStudioContext,
  createTempStudioContext,
  execSql,
  listMigrationFiles,
  policyExists,
  readArtifactDataOrThrow,
  readMigrationFile,
  requireDbOrWarn,
  tableExists,
  tableRlsEnabled,
  uniqueName,
  writeMigrationFile,
} from "./harness/studio-e2e-harness.js";

type ToolInputs = Record<string, unknown>;

interface WorkflowCase {
  workflowId: string;
  setup: (ctx: PluginContext) => Promise<{ toolInputs?: ToolInputs; cleanupDb?: () => Promise<void> }>;
  assert: (ctx: PluginContext, run: WorkflowRun) => Promise<void>;
}

function buildRegistry(workflowId: string, toolInputs: ToolInputs = {}): ToolRegistry {
  const workflow = STUDIO_WORKFLOWS_BY_ID.get(workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
  const required = new Set(workflow.steps.map((s) => s.tool));

  const registry: ToolRegistry = {};
  for (const toolId of required) {
    const tool = STUDIO_TOOLS_BY_ID.get(toolId);
    if (!tool) throw new Error(`Tool not found in discovery: ${toolId}`);
    registry[toolId] = async (ctx: PluginContext) => {
      const input = toolInputs[toolId] as never;
      await tool.run(ctx, input);
    };
  }
  return registry;
}

async function runWorkflowToCompletion(workflowId: string, ctx: PluginContext, toolInputs: ToolInputs = {}): Promise<WorkflowRun> {
  const workflow = STUDIO_WORKFLOWS_BY_ID.get(workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
  let run = await startWorkflow(workflowId, workflow.steps, ctx, buildRegistry(workflowId, toolInputs));
  while (run.status === "waiting_checkpoint") {
    run = await resumeWorkflow(run, workflow.steps, ctx, buildRegistry(workflowId, toolInputs));
  }
  return run;
}

const CASES: Record<string, WorkflowCase> = {
  "adopt-backend": {
    workflowId: "adopt-backend",
    async setup(ctx) {
      const table = uniqueName("wf_adopt");
      const migrationName = `20260221010101_adopt_${table}.sql`;
      const sql = `create table if not exists public.${table} (id uuid primary key);`;
      await execSql(sql);
      writeMigrationFile(ctx, migrationName, sql);
      return {
        cleanupDb: async () => {
          await execSql(`drop table if exists public.${table} cascade;`);
        },
      };
    },
    async assert(ctx, run) {
      expect(run.status).toBe("completed");
      expect(run.steps.map((s) => s.stepId)).toEqual(["introspect", "sql-parse", "intent-sync", "intent-init"]);
      readArtifactDataOrThrow(ctx, STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT);
      readArtifactDataOrThrow(ctx, STUDIO_ARTIFACTS.SQL_AST);
      readArtifactDataOrThrow(ctx, STUDIO_ARTIFACTS.INTENT_SYNC);
      const graph = readArtifactDataOrThrow<IntentGraph>(ctx, STUDIO_ARTIFACTS.INTENT_GRAPH);
      expect(graph.entities.length).toBeGreaterThan(0);
    },
  },
  "release-check": {
    workflowId: "release-check",
    async setup(ctx) {
      const table = uniqueName("wf_release");
      const migrationName = `20260221010202_release_${table}.sql`;
      const sql = `create table if not exists public.${table} (id uuid primary key);`;
      await execSql(sql);
      writeMigrationFile(ctx, migrationName, sql);
      const adoptRun = await runWorkflowToCompletion("adopt-backend", ctx);
      expect(adoptRun.status).toBe("completed");
      return {
        cleanupDb: async () => {
          await execSql(`drop table if exists public.${table} cascade;`);
        },
      };
    },
    async assert(ctx, run) {
      expect(run.status).toBe("completed");
      expect(run.steps.map((s) => s.stepId)).toEqual(["rls-check", "rpc-lint", "migration-lint", "release-gate"]);
      const gate = readArtifactDataOrThrow<{ status: string; blocking: Array<{ code: string }> }>(ctx, STUDIO_ARTIFACTS.RELEASE_GATE);
      expect(gate.status === "pass" || gate.status === "fail").toBe(true);
      expect(gate.blocking.some((b) => b.code === "RLS_GAP")).toBe(true);
      const lint = readArtifactDataOrThrow<{ status: string }>(ctx, STUDIO_ARTIFACTS.MIGRATION_LINT);
      expect(lint.status === "pass" || lint.status === "fail").toBe(true);
    },
  },
  "create-table": {
    workflowId: "create-table",
    async setup(ctx) {
      await runGreenfieldInit(ctx);
      await runSqlParse(ctx);
      const table = uniqueName("wf_create");
      const input: CreateTableInput = {
        schema: "public",
        name: table,
        columns: [
          { name: "id", type: "uuid", nullable: false, primaryKey: true, identity: true },
          { name: "email", type: "text", nullable: false },
        ],
        enableRls: true,
      };
      return {
        toolInputs: { "studio-create-table": input },
        cleanupDb: async () => {
          await execSql(`drop table if exists public.${table} cascade;`);
        },
      };
    },
    async assert(ctx, run) {
      expect(run.status).toBe("completed");
      expect(run.steps.map((s) => s.stepId)).toEqual(["create-table", "sql-parse", "migration-lint"]);
      const files = listMigrationFiles(ctx);
      const generated = files.find((f) => f.includes("_create_table_public_wf_create_"));
      expect(generated).toBeTruthy();
      const sql = readMigrationFile(ctx, generated!);
      expect(sql.toLowerCase()).toContain("create table public.");
      expect(sql.toLowerCase()).toContain("enable row level security");

      const tableMatch = /create table\s+public\.(\w+)/i.exec(sql);
      expect(tableMatch?.[1]).toBeTruthy();
      const table = tableMatch![1];

      await execSql(sql);
      expect(await tableExists("public", table)).toBe(true);
      expect(await tableRlsEnabled("public", table)).toBe(true);

      const ast = readArtifactDataOrThrow<{ allEntities: Array<{ id?: string }> }>(ctx, STUDIO_ARTIFACTS.SQL_AST);
      expect(ast.allEntities.some((e) => e.id === `public.${table}`)).toBe(true);
    },
  },
  "add-rls-policy": {
    workflowId: "add-rls-policy",
    async setup(ctx) {
      await runGreenfieldInit(ctx);
      const table = uniqueName("wf_policy");
      await execSql(`
        create table if not exists public.${table} (id uuid primary key, owner_id uuid not null);
        alter table public.${table} enable row level security;
      `);

      const graphEnv = readArtifactOrNull<IntentGraph>(ctx, STUDIO_ARTIFACTS.INTENT_GRAPH.id, STUDIO_ARTIFACTS.INTENT_GRAPH.version);
      if (!graphEnv?.data) {
        throw new Error("Expected intent graph after greenfield init.");
      }
      const graph: IntentGraph = {
        ...graphEnv.data,
        entities: [
          ...graphEnv.data.entities,
          {
            id: `public.${table}`,
            schema: "public",
            name: table,
            managedStatus: "managed",
            confidence: 1,
            columns: [
              { name: "id", type: "uuid", nullable: false, managedStatus: "managed", confidence: 1 },
              { name: "owner_id", type: "uuid", nullable: false, managedStatus: "managed", confidence: 1 },
            ],
            constraints: [],
            indexes: [],
          },
        ],
      };

      writeArtifact(ctx, {
        ...graphEnv,
        producer: "workflow-e2e-test",
        generatedAt: new Date().toISOString(),
        data: graph,
      });

      const input: AddRlsPolicyInput = {
        entityId: `public.${table}`,
        policy: {
          name: `${table}_select_public`,
          command: "SELECT",
          roles: ["public"],
          using: "true",
          permissive: true,
        },
      };

      return {
        toolInputs: { "studio-add-rls-policy": input },
        cleanupDb: async () => {
          await execSql(`drop table if exists public.${table} cascade;`);
        },
      };
    },
    async assert(ctx, run) {
      expect(run.status).toBe("completed");
      expect(run.steps.map((s) => s.stepId)).toEqual(["add-rls-policy", "sql-parse", "rls-check"]);
      const files = listMigrationFiles(ctx);
      const generated = files.find((f) => f.includes("_add_rls_policy_"));
      expect(generated).toBeTruthy();
      const sql = readMigrationFile(ctx, generated!);
      expect(sql.toLowerCase()).toContain("create policy");
      expect(sql.toLowerCase()).toContain(" for select");

      await execSql(sql);
      const entity = /on\s+public\.(\w+)/i.exec(sql)?.[1];
      const policy = /create policy\s+(\w+)/i.exec(sql)?.[1];
      expect(entity).toBeTruthy();
      expect(policy).toBeTruthy();
      expect(await policyExists("public", entity!, policy!)).toBe(true);

      const report = readArtifactDataOrThrow<{ status: string; entitiesChecked: number; gaps: Array<{ entityId: string }> }>(
        ctx,
        STUDIO_ARTIFACTS.RLS_REPORT
      );
      expect(report.entitiesChecked).toBeGreaterThan(0);
      expect(report.status).toBe("fail");
      expect(report.gaps.some((g) => g.entityId === `public.${entity}`)).toBe(true);
    },
  },
};

describe("workflow e2e (real files + real DB)", () => {
  it("has an explicit E2E case for every discovered workflow", () => {
    const discovered = STUDIO_WORKFLOWS.map((w) => w.id).sort((a, b) => a.localeCompare(b));
    const covered = Object.keys(CASES).sort((a, b) => a.localeCompare(b));
    expect(covered).toEqual(discovered);
  });

  for (const workflowId of Object.keys(CASES).sort((a, b) => a.localeCompare(b))) {
    it(`${workflowId} executes end-to-end with intended file and DB outcomes`, async () => {
      const dbOk = await requireDbOrWarn("studio-workflows.e2e");
      if (!dbOk) return;

      const { ctx, root } = createTempStudioContext();
      let cleanupDb: (() => Promise<void>) | undefined;
      try {
        const setupResult = await CASES[workflowId].setup(ctx);
        cleanupDb = setupResult.cleanupDb;
        const run = await runWorkflowToCompletion(workflowId, ctx, setupResult.toolInputs ?? {});
        await CASES[workflowId].assert(ctx, run);
      } finally {
        if (cleanupDb) await cleanupDb().catch(() => undefined);
        cleanupTempStudioContext(root);
      }
    });
  }
});
