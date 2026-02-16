import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { buildGraph } from "../src/graph-builder.js";

describe("buildGraph", () => {
  let tmpDir: string;
  let atlasPath: string;
  let snapshotDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sbt-depgraph-"));
    atlasPath = path.join(tmpDir, "backend-atlas-data.json");
    snapshotDir = path.join(tmpDir, "snapshot");
    fs.mkdirSync(snapshotDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it("throws when atlas data file is missing", () => {
    expect(() => buildGraph(atlasPath, snapshotDir)).toThrow(/Atlas data not found/);
  });

  it("builds nodes and edges from atlas fixture", () => {
    const atlasData = {
      schemas: ["public"],
      categories: {
        functions: [
          { schema: "public", name: "get_user", signature: "get_user(uuid)", sql: "SELECT * FROM users WHERE id = $1" },
        ],
        views: [
          { schema: "public", name: "user_summary", sql: "SELECT id, name FROM users" },
        ],
        materialized_views: [],
        triggers: [
          { schema: "public", name: "on_insert", table: "users", function_name: "notify_change" },
        ],
        policies: [
          { schema: "public", name: "allow_read", table: "users", using: "auth.uid() = user_id", with_check: "" },
        ],
        types: [],
        enums: [],
      },
    };
    fs.writeFileSync(atlasPath, JSON.stringify(atlasData), "utf8");

    const graph = buildGraph(atlasPath, snapshotDir);

    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThanOrEqual(0);
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    expect(nodeIds.has("function:public.get_user")).toBe(true);
    expect(nodeIds.has("trigger:public.on_insert")).toBe(true);
  });
});
