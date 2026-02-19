/**
 * Tests for the two-layer SQL parsing pipeline.
 *
 * Layer 1: regex analyzer (risk metadata) — exercised indirectly via parseMigrationSql.
 * Layer 2: @supabase/pg-parser (AST extraction) — primary focus of these tests.
 *
 * Tests validate:
 * - parseMigrationSql returns correct node types for common DDL
 * - extractSchemaNodes produces typed intent nodes from AST
 * - Supabase system schema exclusion
 * - Opaque block detection (DO $$ ... $$ procedural blocks)
 * - Risk metadata overlay (destructive ops flagged)
 */
import { describe, it, expect } from "vitest";
import { parseMigrationSql, extractSchemaNodes } from "../src/sql-parser.js";

// ---------------------------------------------------------------------------
// CREATE TABLE → EntityNode
// ---------------------------------------------------------------------------

describe("parseMigrationSql — CREATE TABLE", () => {
  it("returns a CreateStmt node for a basic table", async () => {
    const sql = `
      CREATE TABLE public.users (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        email text NOT NULL,
        created_at timestamptz DEFAULT now()
      );
    `;
    const result = await parseMigrationSql(sql, "0001_init.sql");

    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].nodeType).toBe("CreateStmt");
  });

  it("extracts an EntityNode with correct schema and name", async () => {
    const sql = `
      CREATE TABLE public.users (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        email text NOT NULL,
        created_at timestamptz DEFAULT now()
      );
    `;
    const result = await parseMigrationSql(sql);
    const { entities } = extractSchemaNodes(result.statements);

    expect(entities).toHaveLength(1);
    expect(entities[0].schema).toBe("public");
    expect(entities[0].name).toBe("users");
    expect(entities[0].id).toBe("public.users");
  });

  it("extracts column definitions with correct names", async () => {
    const sql = `
      CREATE TABLE public.posts (
        id uuid NOT NULL,
        title text NOT NULL,
        body text
      );
    `;
    const result = await parseMigrationSql(sql);
    const { entities } = extractSchemaNodes(result.statements);

    expect(entities).toHaveLength(1);
    const entity = entities[0];
    expect(entity.columns).toBeDefined();
    const colNames = entity.columns!.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("title");
    expect(colNames).toContain("body");
  });

  it("marks NOT NULL columns as non-nullable", async () => {
    const sql = `
      CREATE TABLE public.items (
        id uuid NOT NULL,
        label text
      );
    `;
    const result = await parseMigrationSql(sql);
    const { entities } = extractSchemaNodes(result.statements);

    const idCol = entities[0].columns!.find((c) => c.name === "id");
    const labelCol = entities[0].columns!.find((c) => c.name === "label");
    expect(idCol?.nullable).toBe(false);
    expect(labelCol?.nullable).toBe(true);
  });

  it("excludes system schema tables (auth.users)", async () => {
    const sql = `
      CREATE TABLE auth.users (id uuid NOT NULL);
    `;
    const result = await parseMigrationSql(sql);
    const { entities } = extractSchemaNodes(result.statements);

    // auth.users must not appear in the intent graph
    expect(entities).toHaveLength(0);
    // The statement IS parsed (not opaque) — astAvailable would be true
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].nodeType).toBe("CreateStmt");
  });

  it("defaults schema to 'public' when none is specified", async () => {
    const sql = `CREATE TABLE widgets (id serial PRIMARY KEY);`;
    const result = await parseMigrationSql(sql);
    const { entities } = extractSchemaNodes(result.statements);

    expect(entities).toHaveLength(1);
    expect(entities[0].schema).toBe("public");
  });
});

// ---------------------------------------------------------------------------
// CREATE POLICY → PolicyNode
// ---------------------------------------------------------------------------

describe("parseMigrationSql — CREATE POLICY", () => {
  it("returns a CreatePolicyStmt node", async () => {
    const sql = `
      CREATE POLICY users_read ON public.users
        FOR SELECT
        TO authenticated
        USING (auth.uid() = id);
    `;
    const result = await parseMigrationSql(sql);

    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].nodeType).toBe("CreatePolicyStmt");
  });

  it("extracts a PolicyNode with correct entity and name", async () => {
    const sql = `
      CREATE POLICY users_read ON public.users
        FOR SELECT
        TO authenticated
        USING (auth.uid() = id);
    `;
    const result = await parseMigrationSql(sql);
    const { policies } = extractSchemaNodes(result.statements);

    expect(policies).toHaveLength(1);
    expect(policies[0].entity).toBe("public.users");
    expect(policies[0].name).toBe("users_read");
  });

  it("maps FOR SELECT to command: SELECT", async () => {
    const sql = `
      CREATE POLICY select_policy ON public.orders
        FOR SELECT TO authenticated USING (true);
    `;
    const result = await parseMigrationSql(sql);
    const { policies } = extractSchemaNodes(result.statements);

    expect(policies[0].command).toBe("SELECT");
  });

  it("extracts role from the policy", async () => {
    const sql = `
      CREATE POLICY insert_own ON public.notes
        FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    `;
    const result = await parseMigrationSql(sql);
    const { policies } = extractSchemaNodes(result.statements);

    expect(policies).toHaveLength(1);
    expect(policies[0].roles).toContain("authenticated");
  });

  it("marks PERMISSIVE policy correctly", async () => {
    const sql = `
      CREATE POLICY read_all ON public.products
        AS PERMISSIVE FOR SELECT TO anon USING (true);
    `;
    const result = await parseMigrationSql(sql);
    const { policies } = extractSchemaNodes(result.statements);

    expect(policies[0].permissive).toBe(true);
  });

  it("excludes policies on system schema tables", async () => {
    const sql = `
      CREATE POLICY auth_users_policy ON auth.users
        FOR SELECT TO authenticated USING (true);
    `;
    const result = await parseMigrationSql(sql);
    const { policies } = extractSchemaNodes(result.statements);

    expect(policies).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// CREATE FUNCTION → FunctionNode
// ---------------------------------------------------------------------------

describe("parseMigrationSql — CREATE FUNCTION", () => {
  it("returns a CreateFunctionStmt node", async () => {
    const sql = `
      CREATE OR REPLACE FUNCTION public.get_user_email(user_id uuid)
      RETURNS text
      LANGUAGE sql
      SECURITY INVOKER
      AS $$
        SELECT email FROM public.users WHERE id = user_id;
      $$;
    `;
    const result = await parseMigrationSql(sql);

    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].nodeType).toBe("CreateFunctionStmt");
  });

  it("extracts FunctionNode with correct schema and name", async () => {
    const sql = `
      CREATE FUNCTION public.hello()
      RETURNS text
      LANGUAGE sql
      AS $$ SELECT 'hello'; $$;
    `;
    const result = await parseMigrationSql(sql);
    const { functions } = extractSchemaNodes(result.statements);

    expect(functions).toHaveLength(1);
    expect(functions[0].schema).toBe("public");
    expect(functions[0].name).toBe("hello");
  });

  it("extracts language correctly", async () => {
    const sql = `
      CREATE FUNCTION public.do_something()
      RETURNS void
      LANGUAGE plpgsql
      AS $$ BEGIN NULL; END; $$;
    `;
    const result = await parseMigrationSql(sql);
    const { functions } = extractSchemaNodes(result.statements);

    expect(functions[0].language).toBe("plpgsql");
  });

  it("detects SECURITY DEFINER", async () => {
    const sql = `
      CREATE FUNCTION public.admin_action()
      RETURNS void
      LANGUAGE sql
      SECURITY DEFINER
      AS $$ SELECT 1; $$;
    `;
    const result = await parseMigrationSql(sql);
    const { functions } = extractSchemaNodes(result.statements);

    expect(functions[0].security).toBe("definer");
  });

  it("defaults to SECURITY INVOKER when not specified", async () => {
    const sql = `
      CREATE FUNCTION public.safe_fn()
      RETURNS void
      LANGUAGE sql
      AS $$ SELECT 1; $$;
    `;
    const result = await parseMigrationSql(sql);
    const { functions } = extractSchemaNodes(result.statements);

    expect(functions[0].security).toBe("invoker");
  });

  it("extracts function argument names and types", async () => {
    const sql = `
      CREATE FUNCTION public.greet(name text, times integer)
      RETURNS text
      LANGUAGE sql
      AS $$ SELECT name; $$;
    `;
    const result = await parseMigrationSql(sql);
    const { functions } = extractSchemaNodes(result.statements);

    expect(functions[0].args).toHaveLength(2);
    expect(functions[0].args![0].name).toBe("name");
    expect(functions[0].args![1].name).toBe("times");
  });

  it("excludes functions in system schemas", async () => {
    const sql = `
      CREATE FUNCTION auth.helper()
      RETURNS void
      LANGUAGE sql
      AS $$ SELECT 1; $$;
    `;
    const result = await parseMigrationSql(sql);
    const { functions } = extractSchemaNodes(result.statements);

    expect(functions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Opaque block detection
// ---------------------------------------------------------------------------

describe("parseMigrationSql — opaque blocks", () => {
  it("marks DO $$ ... $$ as an opaque block with astAvailable: true", async () => {
    const sql = `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
          CREATE TYPE public.user_status AS ENUM ('active', 'inactive');
        END IF;
      END;
      $$;
    `;
    const result = await parseMigrationSql(sql);
    const { opaqueBlocks } = extractSchemaNodes(result.statements);

    // DO $$ ... $$ parses as DoStmt — our walker doesn't model it → opaque
    expect(opaqueBlocks.length).toBeGreaterThanOrEqual(1);
    expect(opaqueBlocks[0].astAvailable).toBe(true);
    expect(opaqueBlocks[0].reason).toBe("unrepresentable");
  });

  it("sets astAvailable: false when the entire SQL fails to parse", async () => {
    // Deliberately invalid SQL
    const sql = `THIS IS NOT VALID SQL !!!@#$`;
    const result = await parseMigrationSql(sql, "bad.sql");

    // The whole file becomes one opaque block
    expect(result.opaqueBlocks.length).toBeGreaterThanOrEqual(1);
    expect(result.opaqueBlocks[0].astAvailable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Risk metadata overlay (Layer 1)
// ---------------------------------------------------------------------------

describe("parseMigrationSql — risk metadata overlay", () => {
  it("flags destructive operations via riskMeta", async () => {
    const sql = `DROP TABLE public.old_data;`;
    const result = await parseMigrationSql(sql);

    expect(result.riskMeta.riskFlags.hasDestructive).toBe(true);
    expect(result.riskMeta.riskFlags.hasDrop).toBe(true);
  });

  it("detects transaction wrapping", async () => {
    const sql = `
      BEGIN;
      CREATE TABLE public.foo (id serial);
      COMMIT;
    `;
    const result = await parseMigrationSql(sql);

    expect(result.riskMeta.riskFlags.hasTransaction).toBe(true);
  });

  it("detects IF NOT EXISTS pattern", async () => {
    const sql = `CREATE TABLE IF NOT EXISTS public.bar (id serial);`;
    const result = await parseMigrationSql(sql);

    expect(result.riskMeta.riskFlags.hasIfNotExists).toBe(true);
  });

  it("reports no risk flags for safe additive migration", async () => {
    const sql = `
      CREATE TABLE public.clean_table (
        id uuid NOT NULL,
        value text
      );
    `;
    const result = await parseMigrationSql(sql);

    expect(result.riskMeta.riskFlags.hasDestructive).toBe(false);
    expect(result.riskMeta.riskFlags.hasDrop).toBe(false);
    expect(result.riskMeta.riskFlags.hasTruncate).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Mixed migration (multiple statement types)
// ---------------------------------------------------------------------------

describe("parseMigrationSql — mixed migrations", () => {
  it("handles multiple statements in one file", async () => {
    const sql = `
      CREATE TABLE public.accounts (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        name text NOT NULL
      );

      CREATE POLICY accounts_select ON public.accounts
        FOR SELECT TO authenticated USING (true);

      CREATE INDEX idx_accounts_name ON public.accounts (name);
    `;
    const result = await parseMigrationSql(sql, "mixed.sql");

    // 3 statements: CREATE TABLE, CREATE POLICY, CREATE INDEX
    expect(result.statements.length).toBe(3);

    const nodeTypes = result.statements.map((s) => s.nodeType);
    expect(nodeTypes).toContain("CreateStmt");
    expect(nodeTypes).toContain("CreatePolicyStmt");
    expect(nodeTypes).toContain("IndexStmt");
  });

  it("extracts entities and policies from a mixed migration", async () => {
    const sql = `
      CREATE TABLE public.products (
        id uuid NOT NULL,
        title text NOT NULL
      );

      CREATE POLICY products_read ON public.products
        FOR SELECT TO anon USING (true);
    `;
    const result = await parseMigrationSql(sql);
    const extracted = extractSchemaNodes(result.statements);

    expect(extracted.entities).toHaveLength(1);
    expect(extracted.policies).toHaveLength(1);
    expect(extracted.entities[0].id).toBe("public.products");
    expect(extracted.policies[0].entity).toBe("public.products");
  });
});

// ---------------------------------------------------------------------------
// CreateExtensionStmt → InfraNode
// ---------------------------------------------------------------------------

describe("parseMigrationSql — CREATE EXTENSION", () => {
  it("extracts an InfraNode for extension creation", async () => {
    const sql = `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;
    const result = await parseMigrationSql(sql);
    const { infrastructure } = extractSchemaNodes(result.statements);

    expect(infrastructure).toHaveLength(1);
    expect(infrastructure[0].type).toBe("extension");
    expect(infrastructure[0].name).toBe("uuid-ossp");
  });
});
