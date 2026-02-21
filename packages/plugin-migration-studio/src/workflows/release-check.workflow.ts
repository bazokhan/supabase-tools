import type { WorkflowStep } from "@sbtools/sdk";
import { STUDIO_ARTIFACTS } from "../artifacts/constants.js";
import type { StudioWorkflowDefinition } from "./workflow-definition.js";

const steps: WorkflowStep[] = [
  {
    id: "rls-check",
    tool: "studio-rls-check",
    inputArtifacts: [{ id: STUDIO_ARTIFACTS.INTENT_GRAPH.id, version: STUDIO_ARTIFACTS.INTENT_GRAPH.version }],
    outputArtifact: { id: STUDIO_ARTIFACTS.RLS_REPORT.id, version: STUDIO_ARTIFACTS.RLS_REPORT.version },
  },
  {
    id: "rpc-lint",
    tool: "studio-rpc-lint",
    inputArtifacts: [{ id: STUDIO_ARTIFACTS.INTENT_GRAPH.id, version: STUDIO_ARTIFACTS.INTENT_GRAPH.version }],
    outputArtifact: { id: STUDIO_ARTIFACTS.RPC_PLAN.id, version: STUDIO_ARTIFACTS.RPC_PLAN.version },
  },
  {
    id: "migration-lint",
    tool: "studio-lint",
    inputArtifacts: [{ id: STUDIO_ARTIFACTS.SQL_AST.id, version: STUDIO_ARTIFACTS.SQL_AST.version }],
    outputArtifact: { id: STUDIO_ARTIFACTS.MIGRATION_LINT.id, version: STUDIO_ARTIFACTS.MIGRATION_LINT.version },
  },
  {
    id: "release-gate",
    tool: "studio-release-gate",
    inputArtifacts: [
      { id: STUDIO_ARTIFACTS.RLS_REPORT.id, version: STUDIO_ARTIFACTS.RLS_REPORT.version },
      { id: STUDIO_ARTIFACTS.RPC_PLAN.id, version: STUDIO_ARTIFACTS.RPC_PLAN.version },
      { id: STUDIO_ARTIFACTS.MIGRATION_LINT.id, version: STUDIO_ARTIFACTS.MIGRATION_LINT.version },
    ],
    outputArtifact: { id: STUDIO_ARTIFACTS.RELEASE_GATE.id, version: STUDIO_ARTIFACTS.RELEASE_GATE.version },
  },
];

export const workflow: StudioWorkflowDefinition = {
  id: "release-check",
  description: "Validation chain before apply: rls-check → rpc-lint → migration-lint → release-gate",
  steps,
};

export default workflow;

