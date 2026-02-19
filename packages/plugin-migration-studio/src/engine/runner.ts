/**
 * Minimal sequential pipeline runner for Migration Studio workflows.
 *
 * Design (see plan §5.4):
 * - No external framework. ~120 lines.
 * - Steps execute in order; each step calls one tool function.
 * - Checkpoint steps pause execution and persist state.
 * - Failed steps record the error and stop the run.
 * - Run state persisted as studio.workflow.run artifact after every state change.
 * - Workflows can be resumed from the step after a checkpoint.
 */
import { randomUUID } from "node:crypto";
import type { PluginContext, WorkflowStep, WorkflowRun, StepResult } from "@sbtools/sdk";
import { readArtifactOrNull } from "@sbtools/sdk";
import { writeWorkflowRunArtifact } from "../artifacts/writers.js";
import { STUDIO_ARTIFACTS } from "../artifacts/constants.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A studio tool callable by the engine. */
export type StudioToolFn = (ctx: PluginContext) => Promise<void>;

/** Registry of tool name → implementation, passed in at call time. */
export type ToolRegistry = Record<string, StudioToolFn>;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString();
}

function persist(ctx: PluginContext, run: WorkflowRun): void {
  run.updatedAt = now();
  writeWorkflowRunArtifact(ctx, run);
}

async function _executeFrom(
  startIndex: number,
  steps: WorkflowStep[],
  run: WorkflowRun,
  ctx: PluginContext,
  registry: ToolRegistry
): Promise<WorkflowRun> {
  for (let i = startIndex; i < steps.length; i++) {
    const step = steps[i];
    run.currentStep = i;

    // Optional skip condition
    if (step.skipWhen) {
      const wfCtx = { runId: run.id, steps: run.steps, artifacts: {} };
      if (step.skipWhen(wfCtx)) {
        run.steps.push({
          stepId: step.id,
          status: "skipped",
          startedAt: now(),
          completedAt: now(),
        });
        persist(ctx, run);
        continue;
      }
    }

    const startedAt = now();
    const toolFn = registry[step.tool];
    if (!toolFn) {
      const result: StepResult = {
        stepId: step.id,
        status: "failed",
        error: `Tool '${step.tool}' not found in registry`,
        startedAt,
        completedAt: now(),
      };
      run.steps.push(result);
      run.status = "failed";
      persist(ctx, run);
      return run;
    }

    try {
      await toolFn(ctx);
      const result: StepResult = {
        stepId: step.id,
        status: "completed",
        artifact: step.outputArtifact,
        startedAt,
        completedAt: now(),
      };
      run.steps.push(result);
      run.currentStep = i + 1;
    } catch (err) {
      const result: StepResult = {
        stepId: step.id,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        startedAt,
        completedAt: now(),
      };
      run.steps.push(result);
      run.status = "failed";
      persist(ctx, run);
      return run;
    }

    // Pause at checkpoints — caller resumes later
    if (step.checkpoint) {
      run.status = "waiting_checkpoint";
      persist(ctx, run);
      return run;
    }

    persist(ctx, run);
  }

  run.status = "completed";
  persist(ctx, run);
  return run;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start a new workflow run from step 0.
 * Returns the run after it completes, fails, or pauses at a checkpoint.
 */
export async function startWorkflow(
  workflowId: string,
  steps: WorkflowStep[],
  ctx: PluginContext,
  registry: ToolRegistry
): Promise<WorkflowRun> {
  const run: WorkflowRun = {
    id: randomUUID(),
    workflowId,
    status: "running",
    currentStep: 0,
    steps: [],
    createdAt: now(),
    updatedAt: now(),
  };
  persist(ctx, run);
  return _executeFrom(0, steps, run, ctx, registry);
}

/**
 * Resume a workflow run from the step after its current checkpoint.
 * The run must have status 'waiting_checkpoint'.
 */
export async function resumeWorkflow(
  run: WorkflowRun,
  steps: WorkflowStep[],
  ctx: PluginContext,
  registry: ToolRegistry
): Promise<WorkflowRun> {
  if (run.status !== "waiting_checkpoint") {
    throw new Error(
      `Cannot resume workflow run ${run.id}: status is '${run.status}', expected 'waiting_checkpoint'`
    );
  }
  run.status = "running";
  persist(ctx, run);
  // currentStep was advanced past the checkpoint step in _executeFrom
  return _executeFrom(run.currentStep, steps, run, ctx, registry);
}

/**
 * Load a workflow run from persisted artifact storage.
 * Returns null if not found.
 */
export function loadWorkflowRun(ctx: PluginContext): WorkflowRun | null {
  const env = readArtifactOrNull<WorkflowRun>(
    ctx,
    STUDIO_ARTIFACTS.WORKFLOW_RUN.id,
    STUDIO_ARTIFACTS.WORKFLOW_RUN.version
  );
  return env?.data ?? null;
}
