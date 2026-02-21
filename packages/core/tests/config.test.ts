import { describe, it, expect } from "vitest";
import { validateConfig } from "../src/config.js";

describe("validateConfig", () => {
  it("accepts an empty object (all fields optional)", () => {
    const result = validateConfig({});
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated config", () => {
    const result = validateConfig({
      paths: {
        migrations: "supabase/migrations",
        snapshot: ".sbt/snapshot",
        docsOutput: ".sbt/docs",
        functions: "supabase/functions",
      },
      db: {
        url: "postgresql://postgres:postgres@localhost:54322/postgres",
        container: "supabase-db",
      },
      api: {
        url: "http://localhost:54321",
        studioUrl: "http://localhost:54323",
        inbucketUrl: "http://localhost:54324",
      },
      project: { name: "my-project" },
      plugins: [{ path: "my-plugin", enabled: true, config: { key: "value" } }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts partial sections", () => {
    const result = validateConfig({ paths: { migrations: "m" }, db: { container: "db" } });
    expect(result.success).toBe(true);
  });

  it("accepts plugins with optional fields", () => {
    const result = validateConfig({
      plugins: [
        { path: "plugin-a" },
        { path: "plugin-b", enabled: false },
        { path: "plugin-c", config: { foo: 1 } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects db.url that is not a URL", () => {
    const result = validateConfig({ db: { url: "not-a-url" } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("db.url");
    }
  });

  it("rejects unknown top-level keys (strict mode)", () => {
    const result = validateConfig({ unknownKey: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("Unknown");
    }
  });

  it("includes field path in error messages", () => {
    const result = validateConfig({ api: { url: "bad" } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toBe("api.url");
    }
  });

  // --- Plugin-specific keys must NOT be in root config ---

  it("rejects root-level erd section (moved to plugin config)", () => {
    const result = validateConfig({ erd: { displayColumns: ["name"] } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("Unknown");
    }
  });

  it("rejects paths.erdOutput (moved to plugin config)", () => {
    const result = validateConfig({ paths: { erdOutput: "docs/erd" } });
    expect(result.success).toBe(false);
  });

  it("rejects paths.typesOutput (moved to plugin config)", () => {
    const result = validateConfig({ paths: { typesOutput: "src/types.ts" } });
    expect(result.success).toBe(false);
  });

  it("rejects paths.tests (moved to plugin config)", () => {
    const result = validateConfig({ paths: { tests: "supabase/tests" } });
    expect(result.success).toBe(false);
  });

  it("accepts init-shaped config (no plugin-specific keys)", () => {
    const result = validateConfig({
      paths: { migrations: "supabase/migrations", snapshot: ".sbt/snapshot",
        docsOutput: ".sbt/docs", functions: "supabase/functions" },
      db: { url: "postgresql://postgres:postgres@localhost:54322/postgres", container: "supabase-db" },
      api: { url: "http://localhost:54321", studioUrl: "http://localhost:54323", inbucketUrl: "http://localhost:54324" },
      project: { name: "test-project" },
      plugins: [],
    });
    expect(result.success).toBe(true);
  });
});
