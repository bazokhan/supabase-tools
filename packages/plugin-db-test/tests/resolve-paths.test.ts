import { describe, it, expect } from "vitest";
import path from "node:path";
import type { PluginContext } from "@sbtools/sdk";
import { resolveTestPaths } from "../src/index.js";

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

describe("resolveTestPaths", () => {
  it("defaults testsDir to supabase/tests when no pluginConfig", () => {
    const { testsDir } = resolveTestPaths(makeCtx());
    expect(testsDir).toBe(path.join(PROJECT, "supabase", "tests"));
  });

  it("defaults migrationsDir to ctx.paths.migrations", () => {
    const { migrationsDir } = resolveTestPaths(makeCtx());
    expect(migrationsDir).toBe(path.join(PROJECT, "supabase", "migrations"));
  });

  it("uses pluginConfig.testsDir when set", () => {
    const { testsDir } = resolveTestPaths(makeCtx({ testsDir: "custom/tests" }));
    expect(testsDir).toBe("custom/tests");
  });

  it("uses pluginConfig.migrationsDir when set", () => {
    const { migrationsDir } = resolveTestPaths(makeCtx({ migrationsDir: "custom/migrations" }));
    expect(migrationsDir).toBe("custom/migrations");
  });

  it("inherits migrations from root config paths", () => {
    const ctx = makeCtx();
    ctx.paths.migrations = path.join(PROJECT, "custom", "migrations");
    const { migrationsDir } = resolveTestPaths(ctx);
    expect(migrationsDir).toBe(path.join(PROJECT, "custom", "migrations"));
  });
});
