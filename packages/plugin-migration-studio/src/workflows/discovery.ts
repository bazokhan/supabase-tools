import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { StudioWorkflowDefinition, WorkflowModuleLike } from "./workflow-definition.js";

function collectWorkflowFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) continue;
    if (/\.workflow\.(?:js|ts|mjs|cjs)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

async function importWorkflow(filePath: string): Promise<StudioWorkflowDefinition> {
  const mod = await import(pathToFileURL(filePath).href) as WorkflowModuleLike;
  const wf = mod.workflow ?? mod.default;
  if (!wf) throw new Error(`Workflow module ${filePath} does not export 'workflow'`);
  return wf;
}

export async function discoverWorkflows(): Promise<StudioWorkflowDefinition[]> {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const files = collectWorkflowFiles(thisDir).sort((a, b) => a.localeCompare(b));
  const workflows = await Promise.all(files.map((file) => importWorkflow(file)));
  const ids = new Set<string>();
  for (const wf of workflows) {
    if (ids.has(wf.id)) throw new Error(`Duplicate workflow id: ${wf.id}`);
    ids.add(wf.id);
  }
  return workflows;
}

export const STUDIO_WORKFLOWS = await discoverWorkflows();

export const STUDIO_WORKFLOWS_BY_ID = new Map(STUDIO_WORKFLOWS.map((wf) => [wf.id, wf]));

