import { describe, it, expect } from "vitest";
import {
  safeName,
  safeFileName,
  sanitizeSlug,
  sanitizeIdentifier,
} from "@sbtools/sdk";

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

describe("sanitizeSlug", () => {
  it("passes through valid slugs", () => {
    expect(sanitizeSlug("my-plugin")).toBe("my-plugin");
    expect(sanitizeSlug("analytics")).toBe("analytics");
  });
  it("replaces invalid chars with hyphen and collapses", () => {
    expect(sanitizeSlug("my plugin")).toBe("my-plugin");
    expect(sanitizeSlug("a--b")).toBe("a-b");
  });
  it("trims leading and trailing hyphens", () => {
    expect(sanitizeSlug("-hello-")).toBe("hello");
  });
  it("replaces underscores with hyphens", () => {
    expect(sanitizeSlug("plugin_123")).toBe("plugin-123");
  });
  it("returns empty for all-invalid input", () => {
    expect(sanitizeSlug("!!!")).toBe("");
  });
});

describe("sanitizeIdentifier", () => {
  it("passes through valid identifiers", () => {
    expect(sanitizeIdentifier("user_id")).toBe("user_id");
    expect(sanitizeIdentifier("Table123")).toBe("Table123");
  });
  it("replaces invalid chars with underscore", () => {
    expect(sanitizeIdentifier("my-table")).toBe("my_table");
    expect(sanitizeIdentifier("a.b.c")).toBe("a_b_c");
  });
  it("handles brackets for Mermaid compatibility", () => {
    expect(sanitizeIdentifier("public.users")).toBe("public_users");
  });
});
