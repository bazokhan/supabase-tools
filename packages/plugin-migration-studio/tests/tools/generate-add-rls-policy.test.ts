/**
 * Tests for generate-add-rls-policy tool.
 */
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { PluginContext } from "@sbtools/sdk";
import { runAddRlsPolicy, buildAddRlsPolicySql } from "../../src/tools/generate-add-rls-policy.js";

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-rls-policy-test-"));
  const sbtDataDir = path.join(dir, ".sbt");
  const migrationsDir = path.join(dir, "supabase", "migrations");
  fs.mkdirSync(sbtDataDir, { recursive: true });
  fs.mkdirSync(migrationsDir, { recursive: true });
  return {
    ctx: {
      projectRoot: dir,
      sbtDataDir,
      pluginConfig: {},
      paths: { migrations: migrationsDir },
    } as unknown as PluginContext,
    migrationsDir,
  };
}

describe("buildAddRlsPolicySql", () => {
  it("generates SELECT policy with USING clause", () => {
    const sql = buildAddRlsPolicySql({
      entityId: "public.users",
      policy: {
        name: "users_select_authenticated",
        command: "SELECT",
        roles: ["authenticated"],
        using: "auth.uid() = id",
      },
    });

    expect(sql).toContain('CREATE POLICY users_select_authenticated');
    expect(sql).toContain("ON public.users");
    expect(sql).toContain("AS PERMISSIVE");
    expect(sql).toContain("FOR SELECT");
    expect(sql).toContain("TO authenticated");
    expect(sql).toContain("USING (auth.uid() = id)");
    expect(sql).not.toContain("WITH CHECK");
  });

  it("generates INSERT policy with WITH CHECK clause", () => {
    const sql = buildAddRlsPolicySql({
      entityId: "public.posts",
      policy: {
        name: "posts_insert_own",
        command: "INSERT",
        roles: ["authenticated"],
        withCheck: "auth.uid() = user_id",
      },
    });

    expect(sql).toContain("FOR INSERT");
    expect(sql).toContain("WITH CHECK (auth.uid() = user_id)");
    expect(sql).not.toContain("USING");
  });

  it("generates UPDATE policy with both USING and WITH CHECK", () => {
    const sql = buildAddRlsPolicySql({
      entityId: "public.posts",
      policy: {
        name: "posts_update_own",
        command: "UPDATE",
        roles: ["authenticated"],
        using: "auth.uid() = user_id",
        withCheck: "auth.uid() = user_id",
      },
    });

    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("USING (auth.uid() = user_id)");
    expect(sql).toContain("WITH CHECK (auth.uid() = user_id)");
  });

  it("generates DELETE policy", () => {
    const sql = buildAddRlsPolicySql({
      entityId: "public.posts",
      policy: {
        name: "posts_delete_own",
        command: "DELETE",
        roles: ["authenticated"],
        using: "auth.uid() = user_id",
      },
    });

    expect(sql).toContain("FOR DELETE");
    expect(sql).toContain("USING (auth.uid() = user_id)");
  });

  it("generates RESTRICTIVE policy", () => {
    const sql = buildAddRlsPolicySql({
      entityId: "public.users",
      policy: {
        name: "users_restrict_anon",
        command: "ALL",
        roles: ["anon"],
        permissive: false,
      },
    });

    expect(sql).toContain("AS RESTRICTIVE");
    expect(sql).not.toContain("PERMISSIVE");
  });

  it("handles multiple roles", () => {
    const sql = buildAddRlsPolicySql({
      entityId: "public.documents",
      policy: {
        name: "docs_read_any",
        command: "SELECT",
        roles: ["authenticated", "service_role"],
        using: "true",
      },
    });

    expect(sql).toContain("TO authenticated, service_role");
  });

  it("parses entity ID without schema prefix as public", () => {
    const sql = buildAddRlsPolicySql({
      entityId: "users",
      policy: {
        name: "users_all",
        command: "ALL",
        roles: ["service_role"],
      },
    });

    expect(sql).toContain("ON public.users");
  });
});

describe("runAddRlsPolicy", () => {
  it("writes migration file and returns sql and filename", async () => {
    const { ctx, migrationsDir } = makeTempCtx();

    const result = await runAddRlsPolicy(ctx, {
      entityId: "public.users",
      policy: {
        name: "users_select_authenticated",
        command: "SELECT",
        roles: ["authenticated"],
        using: "auth.uid() = id",
      },
    });

    expect(result.filename).toMatch(/^\d+_add_rls_policy_.*\.sql$/);
    const filePath = path.join(migrationsDir, result.filename);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toBe(result.sql + "\n");
  });

  it("works without an intent graph", async () => {
    const { ctx } = makeTempCtx();
    // No intent graph — should succeed
    const result = await runAddRlsPolicy(ctx, {
      entityId: "public.items",
      policy: { name: "items_all", command: "ALL", roles: ["service_role"] },
    });

    expect(result.sql).toContain("CREATE POLICY");
  });
});
