import { describe, it, expect } from "vitest";
import {
  sanitizeDbUrl,
  parseSchemaArgs,
  getSchemaFilter,
  normalizeWhitespace,
  splitArgs,
} from "../src/utils/index.js";

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
