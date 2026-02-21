import type { WorkflowStep } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../artifacts/constants.js";
import type { StudioWorkflowDefinition } from "./workflow-definition.js";

const steps: WorkflowStep[] = [
  {
    id: "add-rls-policy",
    tool: "studio-add-rls-policy",
    inputArtifacts: [{ id: STUDIO_ARTIFACTS.INTENT_GRAPH.id, version: STUDIO_ARTIFACTS.INTENT_GRAPH.version }],
    outputArtifact: { id: "migration.file", version: "1.0.0" },
  },
  {
    id: "sql-parse",
    tool: "studio-sql-parse",
    inputArtifacts: [],
    outputArtifact: { id: STUDIO_ARTIFACTS.SQL_AST.id, version: STUDIO_ARTIFACTS.SQL_AST.version },
  },
  {
    id: "rls-check",
    tool: "studio-rls-check",
    inputArtifacts: [{ id: STUDIO_ARTIFACTS.INTENT_GRAPH.id, version: STUDIO_ARTIFACTS.INTENT_GRAPH.version }],
    outputArtifact: { id: STUDIO_ARTIFACTS.RLS_REPORT.id, version: STUDIO_ARTIFACTS.RLS_REPORT.version },
  },
];

export const workflow: StudioWorkflowDefinition = {
  id: "add-rls-policy",
  description: "Guided flow: add an RLS policy then run rls-check preview",
  steps,
};

export default workflow;
