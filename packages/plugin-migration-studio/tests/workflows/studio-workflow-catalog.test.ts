import { describe, expect, it } from "vitest";
import { STUDIO_TOOLS_BY_ID } from "../../src/tools/discovery.js";
import { getCatalog, parseCatalogFilters } from "../../src/catalog.js";
import { STUDIO_WORKFLOWS, STUDIO_WORKFLOWS_BY_ID } from "../../src/workflows/discovery.js";

describe("workflow discovery", () => {
  it("discovers expected workflow IDs", () => {
    const ids = STUDIO_WORKFLOWS.map((w) => w.id).sort();
    expect(ids).toEqual([
      "add-rls-policy",
      "adopt-backend",
      "create-table",
      "release-check",
    ]);
  });

  it("every workflow has steps and each step references a real tool ID", () => {
    for (const workflow of STUDIO_WORKFLOWS) {
      expect(workflow.steps.length).toBeGreaterThan(0);
      for (const step of workflow.steps) {
        expect(STUDIO_TOOLS_BY_ID.has(step.tool)).toBe(true);
      }
    }
  });

  it("workflow id map resolves all discovered workflows", () => {
    for (const workflow of STUDIO_WORKFLOWS) {
      expect(STUDIO_WORKFLOWS_BY_ID.get(workflow.id)?.id).toBe(workflow.id);
    }
  });
});

describe("catalog filters", () => {
  it("filters tools by audience", () => {
    const filters = parseCatalogFilters({ audience: "backend-dev", type: "tools" });
    const out = getCatalog(filters);
    expect(out.workflows).toHaveLength(0);
    expect(out.tools.length).toBeGreaterThan(0);
    expect(out.tools.every((t) => t.audience === "backend-dev")).toBe(true);
  });

  it("filters tools by control mode", () => {
    const filters = parseCatalogFilters({ mode: "managed", type: "tools" });
    const out = getCatalog(filters);
    expect(out.tools.length).toBeGreaterThan(0);
    expect(out.tools.every((t) => t.controlModes.includes("managed"))).toBe(true);
  });

  it("filters workflows by inferred mode", () => {
    const filters = parseCatalogFilters({ mode: "managed", type: "workflows" });
    const out = getCatalog(filters);
    expect(out.tools).toHaveLength(0);
    expect(out.workflows.length).toBeGreaterThan(0);
    expect(out.workflows.every((w) => w.inferredControlModes.includes("managed"))).toBe(true);
  });
});

