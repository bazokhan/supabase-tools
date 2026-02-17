import { describe, it, expect } from "vitest";
import {
  formatFunctionFile,
  formatViewFile,
  formatMaterializedViewFile,
  formatTriggerFile,
  formatPoliciesFile,
  formatTypeFile,
  formatEnumFile,
  formatReadme,
} from "../src/generators/index.js";
import type { PolicyRow } from "@sbtools/sdk";

describe("formatFunctionFile", () => {
  it("produces standard header and DDL", () => {
    const result = formatFunctionFile({
      schema: "public",
      name: "get_user",
      identity_args: "p_id uuid",
      ddl: "CREATE FUNCTION public.get_user(p_id uuid)\nRETURNS jsonb\nLANGUAGE sql\nAS $$ SELECT '{}'::jsonb $$;",
    });
    expect(result).toContain("-- GENERATED: current function definition");
    expect(result).toContain("-- Schema: public");
    expect(result).toContain("-- Function: get_user(p_id uuid)");
    expect(result).toContain("Do not edit manually");
    expect(result).toContain("CREATE FUNCTION public.get_user");
  });
});

describe("formatViewFile", () => {
  it("produces standard header and CREATE OR REPLACE VIEW", () => {
    const result = formatViewFile({
      schema: "public",
      name: "user_summary",
      definition: "SELECT id, name FROM users",
    });
    expect(result).toContain("-- GENERATED: current view definition");
    expect(result).toContain("-- View: user_summary");
    expect(result).toContain("CREATE OR REPLACE VIEW public.user_summary AS");
    expect(result).toContain("SELECT id, name FROM users");
  });
});

describe("formatMaterializedViewFile", () => {
  it("produces standard header and CREATE MATERIALIZED VIEW", () => {
    const result = formatMaterializedViewFile({
      schema: "public",
      name: "mv_stats",
      definition: "SELECT count(*) FROM users",
    });
    expect(result).toContain("-- GENERATED: current materialized view definition");
    expect(result).toContain("-- Materialized View: mv_stats");
    expect(result).toContain("CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_stats AS");
  });
});

describe("formatTriggerFile", () => {
  it("produces standard header and DDL", () => {
    const result = formatTriggerFile({
      schema: "public",
      table_name: "users",
      trigger_name: "on_insert",
      ddl: "CREATE TRIGGER on_insert ...",
    });
    expect(result).toContain("-- GENERATED: current trigger definition");
    expect(result).toContain("-- Table: users");
    expect(result).toContain("-- Trigger: on_insert");
    expect(result).toContain("CREATE TRIGGER on_insert");
  });
});

describe("formatPoliciesFile", () => {
  it("produces policy blocks for table", () => {
    const policies: PolicyRow[] = [
      {
        schema: "public",
        table_name: "users",
        policy_name: "allow_read",
        permissive: true,
        cmd: "SELECT",
        qual: "true",
        with_check: undefined,
      },
    ];
    const result = formatPoliciesFile("public", "users", policies);
    expect(result).toContain("-- GENERATED: current RLS policies for public.users");
    expect(result).toContain('CREATE POLICY "allow_read"');
    expect(result).toContain("ON public.users");
  });
});

describe("formatTypeFile", () => {
  it("produces standard header and DDL", () => {
    const result = formatTypeFile(
      { schema: "public", name: "user_status", type_kind: "composite" },
      "CREATE TYPE public.user_status AS (id uuid, name text);",
    );
    expect(result).toContain("-- GENERATED: current type definition");
    expect(result).toContain("-- Type: user_status (composite)");
    expect(result).toContain("CREATE TYPE public.user_status");
  });
});

describe("formatEnumFile", () => {
  it("produces standard header and DDL", () => {
    const result = formatEnumFile({ schema: "public", name: "status" }, "CREATE TYPE public.status AS ENUM ('a','b');");
    expect(result).toContain("-- GENERATED: current enum definition");
    expect(result).toContain("-- Enum: status");
    expect(result).toContain("CREATE TYPE public.status");
  });
});

describe("formatReadme", () => {
  it("produces README with metadata", () => {
    const meta = {
      timestamp: "2024-01-15T12:00:00Z",
      database_url: "postgresql://***@localhost/postgres",
      postgres_version: "16.1",
      object_counts: { functions: 5, views: 2, materialized_views: 0, triggers: 1, policies: 3, types: 2, enums: 1 },
    };
    const result = formatReadme(meta);
    expect(result).toContain("# Generated Database Snapshot");
    expect(result).toContain("2024-01-15T12:00:00Z");
    expect(result).toContain("postgresql://***@localhost/postgres");
    expect(result).toContain("16.1");
    expect(result).toContain("Regeneration");
  });
});
