import { describe, it, expect } from "vitest";
import path from "node:path";
import type { PluginContext } from "@sbtools/sdk";
import { resolveTypesOutput } from "../src/index.js";

const PROJECT = path.resolve("/test-project");

function makeCtx(pluginConfig: Record<string, unknown> = {}): PluginContext {
  return {
    projectRoot: PROJECT,
    toolsDir: path.join(PROJECT, "node_modules", "@sbtools", "core"),
    sbtDataDir: path.join(PROJECT, ".sbt"),
    artifactsDir: path.join(PROJECT, ".sbt", "artifacts"),
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

describe("resolveTypesOutput", () => {
  it("defaults to src/integrations/supabase/types.ts when no pluginConfig", () => {
    const result = resolveTypesOutput(makeCtx());
    expect(result).toBe(path.join(PROJECT, "src", "integrations", "supabase", "types.ts"));
  });

  it("uses pluginConfig.typesOutput when set (relative)", () => {
    const result = resolveTypesOutput(makeCtx({ typesOutput: "src/types/db.ts" }));
    expect(result).toBe(path.resolve(PROJECT, "src/types/db.ts"));
  });

  it("uses pluginConfig.typesOutput when set (absolute)", () => {
    const abs = path.resolve("/absolute/types.ts");
    const result = resolveTypesOutput(makeCtx({ typesOutput: abs }));
    expect(result).toBe(abs);
  });
});
