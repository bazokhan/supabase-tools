import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it, expect } from "vitest";
import { sanitizeContainerPrefix, deriveContainerPrefix } from "@sbtools/sdk";

describe("sanitizeContainerPrefix", () => {
  it("passes through valid names and lowercases", () => {
    expect(sanitizeContainerPrefix("my-project")).toBe("my-project");
    expect(sanitizeContainerPrefix("MyProject")).toBe("myproject");
  });
  it("replaces invalid chars with hyphen and collapses", () => {
    expect(sanitizeContainerPrefix("my project!")).toBe("my-project");
    expect(sanitizeContainerPrefix("a  b---c")).toBe("a-b-c");
  });
  it("trims leading and trailing hyphens", () => {
    expect(sanitizeContainerPrefix("-hello-")).toBe("hello");
    expect(sanitizeContainerPrefix("--abc--")).toBe("abc");
  });
  it("returns 'sbt' fallback for empty result", () => {
    expect(sanitizeContainerPrefix("")).toBe("sbt");
    expect(sanitizeContainerPrefix("!!!")).toBe("sbt");
    expect(sanitizeContainerPrefix("---")).toBe("sbt");
  });
});

describe("deriveContainerPrefix", () => {
  it("falls back to directory basename when no config", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-test-"));
    try {
      const result = deriveContainerPrefix(tmp);
      expect(result).toBe(sanitizeContainerPrefix(path.basename(tmp)));
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });
  it("uses project.name from config when present", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-test-"));
    try {
      fs.writeFileSync(
        path.join(tmp, "supabase-tools.config.json"),
        JSON.stringify({ project: { name: "My Awesome Project" } }),
        "utf8",
      );
      expect(deriveContainerPrefix(tmp)).toBe("my-awesome-project");
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });
  it("sanitizes config project name", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-test-"));
    try {
      fs.writeFileSync(
        path.join(tmp, "supabase-tools.config.json"),
        JSON.stringify({ project: { name: "Project!!!" } }),
        "utf8",
      );
      expect(deriveContainerPrefix(tmp)).toBe("project");
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });
  it("falls back to basename when config has no project.name", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "derive-test-"));
    try {
      fs.writeFileSync(
        path.join(tmp, "supabase-tools.config.json"),
        JSON.stringify({ paths: {} }),
        "utf8",
      );
      const result = deriveContainerPrefix(tmp);
      expect(result).toBe(sanitizeContainerPrefix(path.basename(tmp)));
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });
  it("falls back to basename on invalid config", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "derive-test-"));
    try {
      fs.writeFileSync(path.join(tmp, "supabase-tools.config.json"), "not json", "utf8");
      const result = deriveContainerPrefix(tmp);
      expect(result).toBe(sanitizeContainerPrefix(path.basename(tmp)));
    } finally {
      fs.rmSync(tmp, { recursive: true });
    }
  });
});
