/**
 * Brownfield adoption workflow — 4 steps, 2 checkpoints.
 *
 * Step 1: introspect     — query live DB → studio.schema.snapshot
 * Step 2: sql-parse      — parse migration files → studio.sql.ast
 *   CHECKPOINT 'review'  — user reviews confidence scores in adoption report
 * Step 3: intent-sync    — compare DB vs SQL → studio.intent.sync-report
 *   CHECKPOINT 'approve' — user confirms managed scope before intent graph is built
 * Step 4: intent-init    — build IntentGraph → studio.intent.graph
 */
import type { WorkflowStep } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../artifacts/constants.js";
import { runIntrospect } from "../tools/introspect.js";
import { runSqlParse } from "../tools/sql-parse.js";
import { runIntentSync } from "../tools/intent-sync.js";
import { runIntentInit } from "../tools/intent-init.js";
import type { ToolRegistry } from "../engine/runner.js";

export const ADOPT_BACKEND_WORKFLOW_ID = "adopt-backend";

export const adoptBackendSteps: WorkflowStep[] = [
  {
    id: "introspect",
    tool: "studio-introspect",
    inputArtifacts: [],
    outputArtifact: {
      id: STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id,
      version: STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.version,
    },
  },
  {
    id: "sql-parse",
    tool: "studio-sql-parse",
    inputArtifacts: [],
    outputArtifact: {
      id: STUDIO_ARTIFACTS.SQL_AST.id,
      version: STUDIO_ARTIFACTS.SQL_AST.version,
    },
  },
  {
    id: "intent-sync",
    tool: "studio-intent-sync",
    inputArtifacts: [
      { id: STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id, version: STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.version },
      { id: STUDIO_ARTIFACTS.SQL_AST.id, version: STUDIO_ARTIFACTS.SQL_AST.version },
    ],
    outputArtifact: {
      id: STUDIO_ARTIFACTS.INTENT_SYNC.id,
      version: STUDIO_ARTIFACTS.INTENT_SYNC.version,
    },
    checkpoint: "review",
  },
  {
    id: "intent-init",
    tool: "studio-intent-init",
    inputArtifacts: [
      { id: STUDIO_ARTIFACTS.INTENT_SYNC.id, version: STUDIO_ARTIFACTS.INTENT_SYNC.version },
    ],
    outputArtifact: {
      id: STUDIO_ARTIFACTS.INTENT_GRAPH.id,
      version: STUDIO_ARTIFACTS.INTENT_GRAPH.version,
    },
    checkpoint: "approve",
  },
];

/** Tool registry for the adopt-backend workflow. */
export const adoptBackendRegistry: ToolRegistry = {
  "studio-introspect": runIntrospect,
  "studio-sql-parse": runSqlParse,
  "studio-intent-sync": runIntentSync,
  "studio-intent-init": runIntentInit,
};
