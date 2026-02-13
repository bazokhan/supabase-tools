import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it, expect } from "vitest";
import { extractComposeKey, extractSupabaseKeys } from "@sbtools/sdk";

function makeTempCompose(content: string): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "compose-test-"));
  const filePath = path.join(tmp, "docker-compose.db.yml");
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function withTempCompose(content: string, fn: (p: string) => void): void {
  const filePath = makeTempCompose(content);
  try {
    fn(filePath);
  } finally {
    fs.rmSync(path.dirname(filePath), { recursive: true });
  }
}

describe("extractComposeKey", () => {
  it("extracts value from first matching pattern", () => {
    withTempCompose("JWT_SECRET: my-secret-123", (p) => {
      const result = extractComposeKey(p, [/JWT_SECRET:\s*([^\s]+)/]);
      expect(result).toBe("my-secret-123");
    });
  });
  it("tries patterns in order, first match wins", () => {
    withTempCompose("AUTH_JWT_SECRET: fallback-secret", (p) => {
      const result = extractComposeKey(p, [
        /JWT_SECRET:\s*([^\s]+)/,
        /AUTH_JWT_SECRET:\s*([^\s]+)/,
      ]);
      expect(result).toBe("fallback-secret");
    });
  });
  it("returns empty string for non-existent file", () => {
    const result = extractComposeKey("/nonexistent/path/compose.yml", [/KEY:\s*([^\s]+)/]);
    expect(result).toBe("");
  });
  it("returns empty string when no pattern matches", () => {
    withTempCompose("OTHER: value", (p) => {
      const result = extractComposeKey(p, [/JWT_SECRET:\s*([^\s]+)/]);
      expect(result).toBe("");
    });
  });
});

describe("extractSupabaseKeys", () => {
  it("extracts both anon and service key", () => {
    withTempCompose(
      [
        "SUPABASE_ANON_KEY: eyJanon123",
        "SUPABASE_SERVICE_ROLE_KEY: eyJservice456",
      ].join("\n"),
      (p) => {
        const { anonKey, serviceKey } = extractSupabaseKeys(p);
        expect(anonKey).toBe("eyJanon123");
        expect(serviceKey).toBe("eyJservice456");
      },
    );
  });
  it("accepts alternative key names", () => {
    withTempCompose(
      ["ANON_KEY: anon-key", "SERVICE_KEY: service-key"].join("\n"),
      (p) => {
        const { anonKey, serviceKey } = extractSupabaseKeys(p);
        expect(anonKey).toBe("anon-key");
        expect(serviceKey).toBe("service-key");
      },
    );
  });
  it("returns empty strings for non-existent file", () => {
    const result = extractSupabaseKeys("/nonexistent/docker-compose.db.yml");
    expect(result).toEqual({ anonKey: "", serviceKey: "" });
  });
  it("returns empty for missing keys", () => {
    withTempCompose("OTHER: value", (p) => {
      const result = extractSupabaseKeys(p);
      expect(result).toEqual({ anonKey: "", serviceKey: "" });
    });
  });
  it("trims whitespace from values", () => {
    withTempCompose(
      [
        "SUPABASE_ANON_KEY:  eyJtrimmed  ",
        "SUPABASE_SERVICE_ROLE_KEY:  eyJalso  ",
      ].join("\n"),
      (p) => {
        const { anonKey, serviceKey } = extractSupabaseKeys(p);
        expect(anonKey).toBe("eyJtrimmed");
        expect(serviceKey).toBe("eyJalso");
      },
    );
  });
});
