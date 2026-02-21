import type { WorkflowStep } from "@sbtools/sdk";

export interface StudioWorkflowDefinition {
  id: string;
  description: string;
  steps: WorkflowStep[];
}

export interface WorkflowModuleLike {
  workflow?: StudioWorkflowDefinition;
  default?: StudioWorkflowDefinition;
}

