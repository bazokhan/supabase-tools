import { describe, it, expect } from "vitest";
import { safeName, safeFileName } from "@sbtools/sdk";
import {
  sanitizeDbUrl, parseSchemaArgs, getSchemaFilter,
  normalizeWhitespace, splitArgs,
} from "../src/utils/index.js";

describe("safeName", () => {
  it("passes through simple names", () => {
    expect(safeName("public")).toBe("public");
  });
  it("replaces special characters with underscore", () => {
    expect(safeName("my schema!@#")).toBe("my_schema___");
  });
  it("preserves dots and hyphens", () => {
    expect(safeName("a.b-c")).toBe("a.b-c");
  });
});

describe("safeFileName", () => {
  it("returns short names as-is", () => {
    expect(safeFileName("test.sql")).toBe("test.sql");
  });
  it("truncates long names and adds hash", () => {
    const long = "a".repeat(200) + ".sql";
    const result = safeFileName(long, 180);
    expect(result.length).toBeLessThanOrEqual(180);
    expect(result.endsWith(".sql")).toBe(true);
  });
  it("produces deterministic output", () => {
    const name = "x".repeat(200) + ".sql";
    expect(safeFileName(name)).toBe(safeFileName(name));
  });
});

describe("sanitizeDbUrl", () => {
  it("masks password in standard URL", () => {
    const result = sanitizeDbUrl("postgresql://user:secret@host:5432/db");
    expect(result).toContain("***");
    expect(result).not.toContain("secret");
  });
  it("handles URLs without password", () => {
    const result = sanitizeDbUrl("postgresql://user@host:5432/db");
    expect(result).not.toContain("***");
  });
  it("uses fallback regex for malformed URLs", () => {
    const result = sanitizeDbUrl("postgres://user:password@host");
    expect(result).not.toContain("password");
  });
});

describe("parseSchemaArgs", () => {
  it("returns ['public'] for empty args", () => {
    expect(parseSchemaArgs([])).toEqual(["public"]);
  });
  it("returns null for 'all'", () => {
    expect(parseSchemaArgs(["all"])).toBeNull();
  });
  it("returns the provided schema names", () => {
    expect(parseSchemaArgs(["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("getSchemaFilter", () => {
  it("returns empty string for null (all schemas)", () => {
    expect(getSchemaFilter(null, "nspname")).toBe("");
  });
  it("defaults to public for empty array", () => {
    expect(getSchemaFilter([], "nspname")).toBe("AND n.nspname = 'public'");
  });
  it("builds IN clause for multiple schemas", () => {
    const result = getSchemaFilter(["a", "b"], "schemaname");
    expect(result).toContain("IN");
    expect(result).toContain("'a'");
    expect(result).toContain("'b'");
  });
  it("escapes single quotes in schema names", () => {
    const result = getSchemaFilter(["it's"], "nspname");
    expect(result).toContain("it''s");
  });
});

describe("normalizeWhitespace", () => {
  it("collapses multiple spaces", () => {
    expect(normalizeWhitespace("a   b   c")).toBe("a b c");
  });
  it("trims and normalizes tabs/newlines", () => {
    expect(normalizeWhitespace("  a\n\tb  ")).toBe("a b");
  });
});

describe("splitArgs", () => {
  it("splits on top-level commas", () => {
    expect(splitArgs("a int, b text")).toEqual(["a int", "b text"]);
  });
  it("respects parentheses", () => {
    expect(splitArgs("a numeric(10,2), b text")).toEqual(["a numeric(10,2)", "b text"]);
  });
  it("respects quoted strings", () => {
    expect(splitArgs(`a text DEFAULT ','`)).toEqual([`a text DEFAULT ','`]);
  });
});
