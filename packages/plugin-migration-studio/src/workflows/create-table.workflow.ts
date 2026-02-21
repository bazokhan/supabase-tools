import type { WorkflowStep } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../artifacts/constants.js";
import type { StudioWorkflowDefinition } from "./workflow-definition.js";

const steps: WorkflowStep[] = [
  {
    id: "create-table",
    tool: "studio-create-table",
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
    id: "migration-lint",
    tool: "studio-lint",
    inputArtifacts: [{ id: STUDIO_ARTIFACTS.SQL_AST.id, version: STUDIO_ARTIFACTS.SQL_AST.version }],
    outputArtifact: { id: STUDIO_ARTIFACTS.MIGRATION_LINT.id, version: STUDIO_ARTIFACTS.MIGRATION_LINT.version },
  },
];

export const workflow: StudioWorkflowDefinition = {
  id: "create-table",
  description: "Guided flow: create-table then lint generated migration",
  steps,
};

export default workflow;
