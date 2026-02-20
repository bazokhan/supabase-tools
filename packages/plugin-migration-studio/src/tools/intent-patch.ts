/**
 * intent-patch tool
 *
 * Mutates a single entity's classification in the intent graph and writes
 * the updated graph back to disk. Two actions are supported:
 *
 *  - "exclude"    → adds entityId to managedScope.explicitExclusions and sets
 *                   entity.managedStatus = "excluded"
 *  - "set-status" → sets entity.managedStatus to the specified value
 */
import { writeArtifact, readArtifactOrNull } from "@sbtools/sdk";
import type { IntentGraph, ManagedStatus, PluginContext } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../artifacts/constants.js";

export type IntentPatchAction = "exclude" | "set-status";

export interface IntentPatchInput {
  entityId: string;
  action: IntentPatchAction;
  /** Required when action === "set-status". */
  status?: ManagedStatus;
}

export interface IntentPatchResult {
  entityId: string;
  previousStatus: ManagedStatus;
  newStatus: ManagedStatus;
  excludedCount: number;
  totalEntities: number;
}

export async function runIntentPatch(ctx: PluginContext, input: IntentPatchInput): Promise<IntentPatchResult> {
  const env = readArtifactOrNull<IntentGraph>(
    ctx,
    STUDIO_ARTIFACTS.INTENT_GRAPH.id,
    STUDIO_ARTIFACTS.INTENT_GRAPH.version
  );

  if (!env?.data) {
    const err = new Error("studio.intent.graph artifact not found — run studio-adopt or studio-greenfield-init first");
    throw Object.assign(err, { code: "MISSING_ARTIFACT" });
  }

  const graph = structuredClone(env.data) as IntentGraph;

  const entity = graph.entities.find((e) => e.id === input.entityId);
  if (!entity) {
    throw new Error(`Entity "${input.entityId}" not found in intent graph`);
  }

  const previousStatus = entity.managedStatus;
  let newStatus: ManagedStatus;

  if (input.action === "exclude") {
    newStatus = "excluded";
    entity.managedStatus = "excluded";
    // Add to explicitExclusions if not already present
    const exclusions = graph.managedScope.explicitExclusions;
    if (!exclusions.includes(input.entityId)) {
      exclusions.push(input.entityId);
    }
  } else {
    // set-status
    if (!input.status) {
      throw new Error("status is required for action: set-status");
    }
    newStatus = input.status;
    entity.managedStatus = input.status;
    // If promoting out of excluded, remove from exclusions list
    if (input.status !== "excluded") {
      graph.managedScope.explicitExclusions = graph.managedScope.explicitExclusions.filter(
        (id) => id !== input.entityId
      );
    }
  }

  writeArtifact(ctx, {
    id: STUDIO_ARTIFACTS.INTENT_GRAPH.id,
    version: STUDIO_ARTIFACTS.INTENT_GRAPH.version,
    producer: "intent-patch",
    generatedAt: new Date().toISOString(),
    data: graph,
  });

  return {
    entityId: input.entityId,
    previousStatus,
    newStatus,
    excludedCount: graph.managedScope.explicitExclusions.length,
    totalEntities: graph.entities.length,
  };
}
