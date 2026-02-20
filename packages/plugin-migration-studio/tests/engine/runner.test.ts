/**
 * Tests for the workflow engine pipeline runner.
 *
 * Verifies:
 * - All steps execute in order on success
 * - Checkpoint steps pause execution (status = 'waiting_checkpoint')
 * - resumeWorkflow continues from after the checkpoint
 * - A failing step records the error and stops the run (status = 'failed')
 * - skipWhen skips the step without calling the tool
 * - Unknown tool name → immediate failure
 */
import { describe, it, expect, vi } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { WorkflowStep, PluginContext } from "@sbtools/sdk";
import { startWorkflow, resumeWorkflow } from "../../src/engine/runner.js";
import type { ToolRegistry } from "../../src/engine/runner.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-runner-test-"));
  const sbtDataDir = path.join(dir, ".sbt");
  fs.mkdirSync(sbtDataDir, { recursive: true });
  return {
    ctx: {
      projectRoot: dir,
      sbtDataDir,
      pluginConfig: {},
      paths: {},
    } as unknown as PluginContext,
  };
}

function makeStep(id: string, opts: Partial<WorkflowStep> = {}): WorkflowStep {
  return {
    id,
    tool: `tool-${id}`,
    inputArtifacts: [],
    outputArtifact: { id: `artifact.${id}`, version: "1.0.0" },
    ...opts,
  };
}

function makeRegistry(stepIds: string[], impl?: () => Promise<void>): ToolRegistry {
  const registry: ToolRegistry = {};
  for (const id of stepIds) {
    registry[`tool-${id}`] = impl ? vi.fn().mockImplementation(impl) : vi.fn().mockResolvedValue(undefined);
  }
  return registry;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("startWorkflow — happy path", () => {
  it("executes all steps and returns status 'completed'", async () => {
    const { ctx } = makeTempCtx();
    const steps = [makeStep("a"), makeStep("b"), makeStep("c")];
    const registry = makeRegistry(["a", "b", "c"]);

    const run = await startWorkflow("test-wf", steps, ctx, registry);

    expect(run.status).toBe("completed");
    expect(run.steps).toHaveLength(3);
    expect(run.steps.map((s) => s.stepId)).toEqual(["a", "b", "c"]);
    expect(run.steps.every((s) => s.status === "completed")).toBe(true);
    expect(registry["tool-a"]).toHaveBeenCalledOnce();
    expect(registry["tool-b"]).toHaveBeenCalledOnce();
    expect(registry["tool-c"]).toHaveBeenCalledOnce();
  });

  it("step result includes the outputArtifact ref", async () => {
    const { ctx } = makeTempCtx();
    const steps = [makeStep("x")];
    const registry = makeRegistry(["x"]);

    const run = await startWorkflow("test-wf", steps, ctx, registry);

    expect(run.steps[0].artifact).toEqual({ id: "artifact.x", version: "1.0.0" });
  });

  it("assigns a unique run ID", async () => {
    const { ctx: ctx1 } = makeTempCtx();
    const { ctx: ctx2 } = makeTempCtx();
    const steps = [makeStep("a")];
    const r1 = await startWorkflow("wf", steps, ctx1, makeRegistry(["a"]));
    const r2 = await startWorkflow("wf", steps, ctx2, makeRegistry(["a"]));

    expect(r1.id).not.toBe(r2.id);
  });
});

describe("startWorkflow — checkpoint", () => {
  it("pauses at checkpoint and returns status 'waiting_checkpoint'", async () => {
    const { ctx } = makeTempCtx();
    const steps = [
      makeStep("a"),
      makeStep("b", { checkpoint: "review" }),
      makeStep("c"),
    ];
    const registry = makeRegistry(["a", "b", "c"]);

    const run = await startWorkflow("test-wf", steps, ctx, registry);

    expect(run.status).toBe("waiting_checkpoint");
    expect(run.steps).toHaveLength(2); // a and b completed
    expect(run.steps[1].stepId).toBe("b");
    expect(run.steps[1].status).toBe("completed");
    // c was NOT called
    expect(registry["tool-c"]).not.toHaveBeenCalled();
  });

  it("currentStep points past the checkpoint step after pause", async () => {
    const { ctx } = makeTempCtx();
    const steps = [
      makeStep("a"),
      makeStep("b", { checkpoint: "review" }),
      makeStep("c"),
    ];
    const registry = makeRegistry(["a", "b", "c"]);

    const run = await startWorkflow("test-wf", steps, ctx, registry);

    // currentStep should be 2 (pointing to 'c', the next step to execute on resume)
    expect(run.currentStep).toBe(2);
  });
});

describe("resumeWorkflow", () => {
  it("continues from after the checkpoint and completes", async () => {
    const { ctx } = makeTempCtx();
    const steps = [
      makeStep("a"),
      makeStep("b", { checkpoint: "review" }),
      makeStep("c"),
    ];
    const registry = makeRegistry(["a", "b", "c"]);

    const pausedRun = await startWorkflow("test-wf", steps, ctx, registry);
    expect(pausedRun.status).toBe("waiting_checkpoint");

    const completedRun = await resumeWorkflow(pausedRun, steps, ctx, registry);

    expect(completedRun.status).toBe("completed");
    expect(completedRun.steps).toHaveLength(3);
    expect(completedRun.steps[2].stepId).toBe("c");
    expect(completedRun.steps[2].status).toBe("completed");
    // a and b were NOT re-executed on resume
    expect(registry["tool-a"]).toHaveBeenCalledOnce();
    expect(registry["tool-b"]).toHaveBeenCalledOnce();
    expect(registry["tool-c"]).toHaveBeenCalledOnce();
  });

  it("throws if run is not in waiting_checkpoint status", async () => {
    const { ctx } = makeTempCtx();
    const steps = [makeStep("a")];
    const registry = makeRegistry(["a"]);

    const completedRun = await startWorkflow("wf", steps, ctx, registry);
    expect(completedRun.status).toBe("completed");

    await expect(resumeWorkflow(completedRun, steps, ctx, registry)).rejects.toThrow();
  });

  it("supports multiple checkpoints", async () => {
    const { ctx } = makeTempCtx();
    const steps = [
      makeStep("a", { checkpoint: "review" }),
      makeStep("b", { checkpoint: "approve" }),
      makeStep("c"),
    ];
    const registry = makeRegistry(["a", "b", "c"]);

    // First run: pauses at step a
    const pause1 = await startWorkflow("wf", steps, ctx, registry);
    expect(pause1.status).toBe("waiting_checkpoint");
    expect(pause1.steps[0].stepId).toBe("a");

    // Resume: pauses at step b
    const pause2 = await resumeWorkflow(pause1, steps, ctx, registry);
    expect(pause2.status).toBe("waiting_checkpoint");
    expect(pause2.steps[1].stepId).toBe("b");

    // Resume again: completes
    const done = await resumeWorkflow(pause2, steps, ctx, registry);
    expect(done.status).toBe("completed");
    expect(done.steps).toHaveLength(3);
  });
});

describe("startWorkflow — failure handling", () => {
  it("records error and stops on tool failure", async () => {
    const { ctx } = makeTempCtx();
    const steps = [makeStep("a"), makeStep("b"), makeStep("c")];
    const registry: ToolRegistry = {
      "tool-a": vi.fn().mockResolvedValue(undefined),
      "tool-b": vi.fn().mockRejectedValue(new Error("something went wrong")),
      "tool-c": vi.fn().mockResolvedValue(undefined),
    };

    const run = await startWorkflow("wf", steps, ctx, registry);

    expect(run.status).toBe("failed");
    expect(run.steps).toHaveLength(2); // a succeeded, b failed
    expect(run.steps[1].status).toBe("failed");
    expect(run.steps[1].error).toBe("something went wrong");
    expect(registry["tool-c"]).not.toHaveBeenCalled();
  });

  it("unknown tool name causes immediate failure", async () => {
    const { ctx } = makeTempCtx();
    const steps = [makeStep("unknown")];
    const registry: ToolRegistry = {}; // empty — no tools registered

    const run = await startWorkflow("wf", steps, ctx, registry);

    expect(run.status).toBe("failed");
    expect(run.steps[0].status).toBe("failed");
    expect(run.steps[0].error).toContain("not found in registry");
  });
});

describe("startWorkflow — skipWhen", () => {
  it("skips step and does not call the tool when skipWhen returns true", async () => {
    const { ctx } = makeTempCtx();
    const steps = [
      makeStep("a"),
      makeStep("b", { skipWhen: () => true }),
      makeStep("c"),
    ];
    const registry = makeRegistry(["a", "b", "c"]);

    const run = await startWorkflow("wf", steps, ctx, registry);

    expect(run.status).toBe("completed");
    expect(run.steps).toHaveLength(3);
    expect(run.steps[1].status).toBe("skipped");
    expect(registry["tool-b"]).not.toHaveBeenCalled();
    expect(registry["tool-c"]).toHaveBeenCalledOnce();
  });

  it("does not skip step when skipWhen returns false", async () => {
    const { ctx } = makeTempCtx();
    const steps = [makeStep("a", { skipWhen: () => false })];
    const registry = makeRegistry(["a"]);

    const run = await startWorkflow("wf", steps, ctx, registry);

    expect(run.steps[0].status).toBe("completed");
    expect(registry["tool-a"]).toHaveBeenCalledOnce();
  });
});
