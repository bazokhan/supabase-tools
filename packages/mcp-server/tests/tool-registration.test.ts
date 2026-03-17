/**
 * Validates that every discovered studio tool has the metadata fields the MCP
 * server relies on for registration.  These tests will fail fast if a new tool
 * is added without the required metadata, long before the runtime would error.
 *
 * Requires plugin-migration-studio to be built first (imports from dist via
 * the sub-path export @sbtools/plugin-migration-studio/tools/discovery).
 */
import { describe, it, expect } from "vitest";
import { STUDIO_TOOLS } from "@sbtools/plugin-migration-studio/tools/discovery";

describe("STUDIO_TOOLS MCP registration readiness", () => {
  it("discovers at least 20 tools", () => {
    expect(STUDIO_TOOLS.length).toBeGreaterThanOrEqual(20);
  });

  it("every tool has a unique non-empty id", () => {
    const ids = STUDIO_TOOLS.map((t) => t.id);
    for (const id of ids) {
      expect(id, "tool id must be a non-empty string").toBeTruthy();
    }
    expect(new Set(ids).size, "tool IDs must be unique").toBe(ids.length);
  });

  it("every tool has non-empty whatItDoes and whenToUse for MCP description", () => {
    for (const tool of STUDIO_TOOLS) {
      expect(tool.metadata.whatItDoes, `${tool.id}: whatItDoes must be set`).toBeTruthy();
      expect(tool.metadata.whenToUse, `${tool.id}: whenToUse must be set`).toBeTruthy();
    }
  });

  it("every tool has array metadata for whatItNeeds and whatItProduces", () => {
    for (const tool of STUDIO_TOOLS) {
      expect(
        Array.isArray(tool.metadata.whatItNeeds),
        `${tool.id}: whatItNeeds must be an array`
      ).toBe(true);
      expect(
        Array.isArray(tool.metadata.whatItProduces),
        `${tool.id}: whatItProduces must be an array`
      ).toBe(true);
    }
  });

  it("every tool has a run function", () => {
    for (const tool of STUDIO_TOOLS) {
      expect(typeof tool.run, `${tool.id}: run must be a function`).toBe("function");
    }
  });

  it("every tool with an http definition has valid method, path, and parseRequest", () => {
    for (const tool of STUDIO_TOOLS) {
      if (!tool.http) continue;
      expect(
        ["GET", "POST"].includes(tool.http.method),
        `${tool.id}: http.method must be GET or POST`
      ).toBe(true);
      expect(tool.http.path, `${tool.id}: http.path must be set`).toBeTruthy();
      expect(
        typeof tool.http.parseRequest,
        `${tool.id}: http.parseRequest must be a function`
      ).toBe("function");
    }
  });
});
