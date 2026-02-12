import { describe, it, expect } from "vitest";
import path from "node:path";
import type { PluginContext } from "@sbtools/sdk";
import { resolveErdOutput } from "../src/index.js";

const PROJECT = path.resolve("/test-project");

function makeCtx(pluginConfig: Record<string, unknown> = {}): PluginContext {
  return {
    projectRoot: PROJECT,
    toolsDir: path.join(PROJECT, "node_modules", "@sbtools", "core"),
    sbtDataDir: path.join(PROJECT, ".sbt"),
    pluginConfig,
    apiUrl: "http://localhost:54321",
    paths: {
      migrations: path.join(PROJECT, "supabase", "migrations"),
      snapshot: path.join(PROJECT, "supabase", "current"),
      docsOutput: path.join(PROJECT, "docs"),
      functions: path.join(PROJECT, "supabase", "functions"),
    },
  };
}

describe("resolveErdOutput", () => {
  it("defaults to docsOutput/entity-relations when no pluginConfig", () => {
    const result = resolveErdOutput(makeCtx());
    expect(result).toBe(path.join(PROJECT, "docs", "entity-relations"));
  });

  it("uses pluginConfig.erdOutput when set (relative)", () => {
    const result = resolveErdOutput(makeCtx({ erdOutput: "custom/erd" }));
    expect(result).toBe(path.resolve(PROJECT, "custom/erd"));
  });

  it("uses pluginConfig.erdOutput when set (absolute)", () => {
    const abs = path.resolve("/absolute/erd/path");
    const result = resolveErdOutput(makeCtx({ erdOutput: abs }));
    expect(result).toBe(abs);
  });

  it("composes with custom docsOutput from root config", () => {
    const ctx = makeCtx();
    ctx.paths.docsOutput = path.join(PROJECT, "docs", "development");
    const result = resolveErdOutput(ctx);
    expect(result).toBe(path.join(PROJECT, "docs", "development", "entity-relations"));
  });
});
