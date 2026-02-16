import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  writeArtifact,
  readArtifact,
  readArtifactOrNull,
  validateArtifactEnvelope,
  parseArtifactEnvelope,
  artifactDir,
  artifactLatestPath,
  type ArtifactEnvelope,
} from "@sbtools/sdk";

const TEMP = path.join(os.tmpdir(), `sbt-artifacts-test-${Date.now()}`);

function makeCtx() {
  return { sbtDataDir: TEMP };
}

describe("artifacts", () => {
  const sampleEnvelope: ArtifactEnvelope<{ count: number }> = {
    id: "migration.analysis",
    version: "1.0.0",
    producer: "@sbtools/plugin-migration-audit",
    generatedAt: new Date().toISOString(),
    inputs: { projectRoot: "/workspace" },
    meta: { toolVersion: "0.4.0" },
    data: { count: 42 },
  };

  it("validateArtifactEnvelope accepts valid envelope", () => {
    expect(validateArtifactEnvelope(sampleEnvelope)).toBe(true);
  });

  it("validateArtifactEnvelope rejects invalid id", () => {
    expect(validateArtifactEnvelope({ ...sampleEnvelope, id: "invalid-id!" })).toBe(false);
  });

  it("validateArtifactEnvelope rejects invalid version", () => {
    expect(validateArtifactEnvelope({ ...sampleEnvelope, version: "1.0" })).toBe(false);
  });

  it("validateArtifactEnvelope rejects missing data", () => {
    const { data, ...rest } = sampleEnvelope;
    expect(validateArtifactEnvelope(rest)).toBe(false);
  });

  it("parseArtifactEnvelope parses valid JSON", () => {
    const raw = JSON.stringify(sampleEnvelope);
    const parsed = parseArtifactEnvelope<{ count: number }>(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.data.count).toBe(42);
  });

  it("parseArtifactEnvelope returns null for invalid JSON", () => {
    expect(parseArtifactEnvelope("{ invalid }")).toBeNull();
  });

  it("artifactDir and artifactLatestPath return correct paths", () => {
    expect(artifactDir(TEMP, "foo.bar", "1.0.0")).toBe(
      path.join(TEMP, "artifacts", "foo.bar", "1.0.0")
    );
    expect(artifactLatestPath(TEMP, "foo.bar", "1.0.0")).toBe(
      path.join(TEMP, "artifacts", "foo.bar", "1.0.0", "latest.json")
    );
  });

  it("writeArtifact and readArtifact round-trip", () => {
    fs.mkdirSync(TEMP, { recursive: true });
    const ctx = makeCtx();
    writeArtifact(ctx, sampleEnvelope);
    const result = readArtifact<{ count: number }>(ctx, "migration.analysis", "1.0.0");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope.data.count).toBe(42);
      expect(result.envelope.producer).toBe("@sbtools/plugin-migration-audit");
    }
  });

  it("readArtifact returns missing when file does not exist", () => {
    const ctx = makeCtx();
    const result = readArtifact(ctx, "nonexistent", "1.0.0");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing");
  });

  it("readArtifactOrNull returns null when missing", () => {
    const ctx = makeCtx();
    const envelope = readArtifactOrNull<{ count: number }>(ctx, "nonexistent", "1.0.0");
    expect(envelope).toBeNull();
  });
});
