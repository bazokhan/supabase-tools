import { STUDIO_TOOLS, STUDIO_TOOLS_BY_ID } from "./tools/discovery.js";
import { STUDIO_WORKFLOWS } from "./workflows/discovery.js";
import type { LoadedToolDefinition } from "./tools/tool-definition.js";

export type CatalogAudience = "backend-dev" | "business" | "mixed";
export type CatalogMode = "managed" | "assisted" | "loose";
export type CatalogType = "tools" | "workflows" | "all";

export interface CatalogFilters {
  audience?: CatalogAudience;
  mode?: CatalogMode;
  type?: CatalogType;
}

export interface ToolCatalogItem {
  id: string;
  command?: string;
  aliases?: string[];
  description?: string;
  audience?: CatalogAudience;
  controlModes: CatalogMode[];
  whatItDoes: string;
  whenToUse: string;
}

export interface WorkflowCatalogItem {
  id: string;
  description: string;
  steps: string[];
  inferredAudiences: CatalogAudience[];
  inferredControlModes: CatalogMode[];
}

function parseType(value?: string): CatalogType {
  if (value === "tools" || value === "workflows" || value === "all") return value;
  return "all";
}

export function parseCatalogFilters(raw: {
  audience?: string;
  mode?: string;
  type?: string;
}): CatalogFilters {
  const audience = raw.audience === "backend-dev" || raw.audience === "business" || raw.audience === "mixed"
    ? raw.audience
    : undefined;
  const mode = raw.mode === "managed" || raw.mode === "assisted" || raw.mode === "loose"
    ? raw.mode
    : undefined;
  return { audience, mode, type: parseType(raw.type) };
}

function toolMatches(tool: LoadedToolDefinition, filters: CatalogFilters): boolean {
  if (filters.audience && tool.metadata.audience !== filters.audience) return false;
  if (filters.mode) {
    const modes = tool.metadata.controlModes ?? [];
    if (!modes.includes(filters.mode)) return false;
  }
  return true;
}

function toToolItem(tool: LoadedToolDefinition): ToolCatalogItem {
  return {
    id: tool.id,
    command: tool.cli?.command,
    aliases: tool.cli?.aliases,
    description: tool.cli?.description,
    audience: tool.metadata.audience,
    controlModes: tool.metadata.controlModes ?? [],
    whatItDoes: tool.metadata.whatItDoes,
    whenToUse: tool.metadata.whenToUse,
  };
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function inferWorkflowMeta(toolIds: string[]): Pick<WorkflowCatalogItem, "inferredAudiences" | "inferredControlModes"> {
  const audiences: CatalogAudience[] = [];
  const modes: CatalogMode[] = [];
  for (const id of toolIds) {
    const tool = STUDIO_TOOLS_BY_ID.get(id);
    if (!tool?.metadata) continue;
    if (tool.metadata.audience) audiences.push(tool.metadata.audience);
    modes.push(...(tool.metadata.controlModes ?? []));
  }
  return {
    inferredAudiences: unique(audiences),
    inferredControlModes: unique(modes),
  };
}

export function getCatalog(filters: CatalogFilters): {
  tools: ToolCatalogItem[];
  workflows: WorkflowCatalogItem[];
} {
  const type = filters.type ?? "all";
  const tools = type === "workflows"
    ? []
    : STUDIO_TOOLS.filter((tool) => toolMatches(tool, filters)).map(toToolItem);

  const workflows = type === "tools"
    ? []
    : STUDIO_WORKFLOWS
        .map((wf) => {
          const steps = wf.steps.map((s) => s.tool);
          const meta = inferWorkflowMeta(steps);
          return {
            id: wf.id,
            description: wf.description,
            steps,
            inferredAudiences: meta.inferredAudiences,
            inferredControlModes: meta.inferredControlModes,
          };
        })
        .filter((wf) => {
          if (filters.audience && !wf.inferredAudiences.includes(filters.audience)) return false;
          if (filters.mode && !wf.inferredControlModes.includes(filters.mode)) return false;
          return true;
        });

  return { tools, workflows };
}

