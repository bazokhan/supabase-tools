import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveDbUrl } from "../src/db-utils.js";

describe("resolveDbUrl", () => {
  const envVars = ["DATABASE_URL", "SUPABASE_DB_URL", "POSTGRES_URL"] as const;
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envVars) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envVars) {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  it("returns DATABASE_URL when set", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@host/db1";
    expect(resolveDbUrl()).toBe("postgresql://user:pass@host/db1");
  });

  it("returns SUPABASE_DB_URL when DATABASE_URL is unset", () => {
    process.env.SUPABASE_DB_URL = "postgresql://user:pass@host/db2";
    expect(resolveDbUrl()).toBe("postgresql://user:pass@host/db2");
  });

  it("returns POSTGRES_URL when DATABASE_URL and SUPABASE_DB_URL are unset", () => {
    process.env.POSTGRES_URL = "postgresql://user:pass@host/db3";
    expect(resolveDbUrl()).toBe("postgresql://user:pass@host/db3");
  });

  it("returns default URL when no env vars are set", () => {
    const url = resolveDbUrl();
    expect(url).toBe("postgresql://postgres:postgres@localhost:54322/postgres");
  });

  it("prefers DATABASE_URL over SUPABASE_DB_URL", () => {
    process.env.DATABASE_URL = "postgresql://first/db";
    process.env.SUPABASE_DB_URL = "postgresql://second/db";
    expect(resolveDbUrl()).toBe("postgresql://first/db");
  });
});
