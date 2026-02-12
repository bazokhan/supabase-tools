import { describe, it, expect } from "vitest";
import path from "node:path";
import type { PluginContext } from "@sbtools/sdk";
import { resolvePaths } from "../src/index.js";

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

describe("resolvePaths", () => {
  it("uses ctx.paths.docsOutput for docsDir", () => {
    const { docsDir } = resolvePaths(makeCtx());
    expect(docsDir).toBe(path.join(PROJECT, "docs"));
  });

  it("uses ctx.paths.snapshot for snapshotDir", () => {
    const { snapshotDir } = resolvePaths(makeCtx());
    expect(snapshotDir).toBe(path.join(PROJECT, "supabase", "current"));
  });

  it("defaults typesFilePath to standard location", () => {
    const { typesFilePath } = resolvePaths(makeCtx());
    expect(typesFilePath).toBe(path.join(PROJECT, "src", "integrations", "supabase", "types.ts"));
  });

  it("uses pluginConfig.typesFilePath when set", () => {
    const { typesFilePath } = resolvePaths(makeCtx({ typesFilePath: "src/types/db.ts" }));
    expect(typesFilePath).toBe("src/types/db.ts");
  });

  it("follows custom docsOutput from root config", () => {
    const ctx = makeCtx();
    ctx.paths.docsOutput = path.join(PROJECT, "docs", "dev");
    const { docsDir, htmlOutput } = resolvePaths(ctx);
    expect(docsDir).toBe(path.join(PROJECT, "docs", "dev"));
    expect(htmlOutput).toBe(path.join(PROJECT, "docs", "dev", "dependency-graph.html"));
  });
});
