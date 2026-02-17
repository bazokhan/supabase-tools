import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { buildAtlasDataFromDir } from "../src/commands/generate-data.js";

describe("buildAtlasDataFromDir", () => {
  let tmpDir: string;
  let metaPath: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sbt-gen-"));
    metaPath = path.join(tmpDir, "_meta", "snapshot.json");
    fs.mkdirSync(path.join(tmpDir, "_meta"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "functions"), { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it("throws when snapshot metadata is missing", () => {
    expect(() => buildAtlasDataFromDir(tmpDir)).toThrow(/Snapshot metadata not found/);
  });

  it("returns AtlasData shape with meta, schemas, categories", () => {
    fs.writeFileSync(
      metaPath,
      JSON.stringify({
        timestamp: "2024-01-15T12:00:00Z",
        database_url: "postgresql://***@localhost/postgres",
        postgres_version: "16.1",
        object_counts: {
          functions: 1,
          views: 0,
          materialized_views: 0,
          triggers: 0,
          policies: 0,
          types: 0,
          enums: 0,
        },
      }),
      "utf8"
    );
    fs.writeFileSync(
      path.join(tmpDir, "functions", "public.get_user.sql"),
      `-- GENERATED: current function definition
-- Schema: public
-- Function: get_user(p_id uuid)
CREATE FUNCTION public.get_user(p_id uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;`,
      "utf8"
    );

    const data = buildAtlasDataFromDir(tmpDir);

    expect(data).toHaveProperty("meta");
    expect(data.meta).toHaveProperty("timestamp");
    expect(data.meta).toHaveProperty("generated_at");
    expect(data.meta.object_counts.functions).toBe(1);
    expect(data).toHaveProperty("schemas");
    expect(Array.isArray(data.schemas)).toBe(true);
    expect(data).toHaveProperty("categories");
    expect(data.categories).toHaveProperty("functions");
    expect(data.categories.functions).toHaveLength(1);
    expect((data.categories.functions as { name: string }[])[0].name).toBe("get_user");
  });
});
