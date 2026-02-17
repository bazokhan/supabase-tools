import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { extractEdgeFunctions } from "../src/extractor.js";

describe("extractEdgeFunctions", () => {
  let tmpDir: string;
  let functionsDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sbt-ef-"));
    functionsDir = path.join(tmpDir, "functions");
    fs.mkdirSync(functionsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when functions dir does not exist", () => {
    const result = extractEdgeFunctions({
      functionsPath: path.join(tmpDir, "nonexistent"),
    });
    expect(result).toEqual([]);
  });

  it("returns empty array when no index.ts in function dirs", () => {
    fs.mkdirSync(path.join(functionsDir, "my-fn"), { recursive: true });
    const result = extractEdgeFunctions({ functionsPath: functionsDir });
    expect(result).toEqual([]);
  });

  it("extracts edge function from index.ts with req.method and req.json", () => {
    const fnDir = path.join(functionsDir, "hello");
    fs.mkdirSync(fnDir, { recursive: true });
    fs.writeFileSync(
      path.join(fnDir, "index.ts"),
      `export default async (req: Request) => {
  if (req.method === "POST") {
    const { name } = await req.json();
    return new Response(JSON.stringify({ message: "Hello " + name }));
  }
  return new Response("OK");
};`,
      "utf8"
    );
    const result = extractEdgeFunctions({
      functionsPath: functionsDir,
      baseUrl: "/functions/v1",
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("hello");
    expect(result[0].methods).toContain("POST");
    expect(result[0].request_fields).toContainEqual(
      expect.objectContaining({ name: "name" })
    );
  });
});
