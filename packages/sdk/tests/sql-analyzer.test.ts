import { describe, it, expect } from "vitest";
import { analyzeMigrationSql } from "@sbtools/sdk";

describe("analyzeMigrationSql", () => {
  it("detects create table", () => {
    const sql = `CREATE TABLE public.users (id uuid PRIMARY KEY);`;
    const r = analyzeMigrationSql(sql);
    expect(r.operations.some((o) => o.kind === "create_table")).toBe(true);
    expect(r.touchedObjectKeys).toContain("public.users");
    expect(r.confidence).toBe("high");
  });

  it("detects drop table", () => {
    const sql = `DROP TABLE IF EXISTS public.old_table;`;
    const r = analyzeMigrationSql(sql);
    expect(r.operations.some((o) => o.kind === "drop_table")).toBe(true);
    expect(r.riskFlags.hasDestructive).toBe(true);
    expect(r.riskFlags.hasIfExists).toBe(true);
  });

  it("detects create function", () => {
    const sql = `CREATE OR REPLACE FUNCTION public.hello() RETURNS text AS $$ SELECT 'hi' $$ LANGUAGE sql;`;
    const r = analyzeMigrationSql(sql);
    expect(r.operations.some((o) => o.kind === "create_function")).toBe(true);
  });

  it("empty SQL has high confidence", () => {
    const r = analyzeMigrationSql("");
    expect(r.operations).toHaveLength(0);
    expect(r.confidence).toBe("high");
  });
});
