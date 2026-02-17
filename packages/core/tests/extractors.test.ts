import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Client } from "pg";
import type { SnapshotContext } from "@sbtools/sdk";
import {
  extractFunctions,
  extractViews,
  extractMaterializedViews,
  extractTriggers,
  extractPolicies,
  extractTypes,
  extractEnums,
} from "../src/extractors/index.js";

describe("extractors", () => {
  let tmpDir: string;
  let mockClient: { query: ReturnType<typeof vi.fn> };
  let ctx: SnapshotContext;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "sbt-extract-"));
    mockClient = { query: vi.fn() };
    ctx = {
      outDir: tmpDir,
      schemaFilterNsp: { clause: "", params: [] },
      schemaFilterSchemaname: { clause: "", params: [] },
      meta: {
        timestamp: "",
        database_url: "",
        postgres_version: "",
        object_counts: {
          functions: 0,
          views: 0,
          materialized_views: 0,
          triggers: 0,
          policies: 0,
          types: 0,
          enums: 0,
        },
      },
    };
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  describe("extractFunctions", () => {
    it("writes one file per function and increments meta", async () => {
      (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [
          {
            schema: "public",
            name: "get_user",
            identity_args: "p_id uuid",
            ddl: "CREATE FUNCTION public.get_user(p_id uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;",
          },
        ],
      });
      await extractFunctions(mockClient as unknown as Client, ctx);
      const fnDir = path.join(tmpDir, "functions");
      expect(fs.existsSync(fnDir)).toBe(true);
      const files = fs.readdirSync(fnDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/public\.get_user\.sql$/);
      expect(ctx.meta.object_counts.functions).toBe(1);
      const content = fs.readFileSync(path.join(fnDir, files[0]), "utf8");
      expect(content).toContain("CREATE FUNCTION");
      expect(content).toContain("-- Schema: public");
    });
  });

  describe("extractViews", () => {
    it("writes one file per view and increments meta", async () => {
      (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [
          { schema: "public", name: "user_summary", definition: "SELECT id, name FROM users" },
        ],
      });
      await extractViews(mockClient as unknown as Client, ctx);
      const viewsDir = path.join(tmpDir, "views");
      expect(fs.existsSync(viewsDir)).toBe(true);
      const files = fs.readdirSync(viewsDir);
      expect(files).toHaveLength(1);
      expect(ctx.meta.object_counts.views).toBe(1);
    });
  });

  describe("extractMaterializedViews", () => {
    it("writes one file per materialized view and increments meta", async () => {
      (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [
          { schema: "public", name: "mv_stats", definition: "SELECT count(*) FROM users" },
        ],
      });
      await extractMaterializedViews(mockClient as unknown as Client, ctx);
      const viewsDir = path.join(tmpDir, "views");
      const files = fs.readdirSync(viewsDir);
      expect(files.some((f) => f.includes("materialized"))).toBe(true);
      expect(ctx.meta.object_counts.materialized_views).toBe(1);
    });
  });

  describe("extractTriggers", () => {
    it("writes one file per trigger and increments meta", async () => {
      (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [
          {
            schema: "public",
            table_name: "users",
            trigger_name: "on_insert",
            ddl: "CREATE TRIGGER on_insert BEFORE INSERT ON public.users ...",
          },
        ],
      });
      await extractTriggers(mockClient as unknown as Client, ctx);
      const triggersDir = path.join(tmpDir, "triggers");
      expect(fs.existsSync(triggersDir)).toBe(true);
      expect(ctx.meta.object_counts.triggers).toBe(1);
    });
  });

  describe("extractPolicies", () => {
    it("groups policies by table and writes one file per table", async () => {
      (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [
          {
            schema: "public",
            table_name: "users",
            policy_name: "allow_read",
            permissive: true,
            roles: '{"authenticated"}',
            cmd: "SELECT",
            qual: "true",
            with_check: undefined,
          },
        ],
      });
      await extractPolicies(mockClient as unknown as Client, ctx);
      const policiesDir = path.join(tmpDir, "policies");
      expect(fs.existsSync(policiesDir)).toBe(true);
      const files = fs.readdirSync(policiesDir);
      expect(files).toHaveLength(1);
      expect(ctx.meta.object_counts.policies).toBe(1);
    });
  });

  describe("extractTypes", () => {
    it("writes one file per type and increments meta", async () => {
      (mockClient.query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          rows: [
            { schema: "public", name: "user_status", definition: "public.user_status", type_kind: "composite" },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });
      await extractTypes(mockClient as unknown as Client, ctx);
      const typesDir = path.join(tmpDir, "types");
      expect(fs.existsSync(typesDir)).toBe(true);
      expect(ctx.meta.object_counts.types).toBe(1);
    });
  });

  describe("extractEnums", () => {
    it("writes one file per enum and increments meta", async () => {
      (mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [
          { schema: "public", name: "status", values: ["active", "inactive"] },
        ],
      });
      await extractEnums(mockClient as unknown as Client, ctx);
      const enumsDir = path.join(tmpDir, "enums");
      expect(fs.existsSync(enumsDir)).toBe(true);
      const content = fs.readFileSync(path.join(enumsDir, "public.status.sql"), "utf8");
      expect(content).toContain("CREATE TYPE");
      expect(content).toContain("'active'");
      expect(ctx.meta.object_counts.enums).toBe(1);
    });
  });
});
