import type { WorkflowStep } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../artifacts/constants.js";
import type { StudioWorkflowDefinition } from "./workflow-definition.js";

export const ADOPT_BACKEND_WORKFLOW_ID = "adopt-backend";

const steps: WorkflowStep[] = [
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

export const workflow: StudioWorkflowDefinition = {
  id: ADOPT_BACKEND_WORKFLOW_ID,
  description: "Brownfield adoption workflow with review and approval checkpoints",
  steps,
};

export default workflow;

