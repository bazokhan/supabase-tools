/**
 * Tests for generate-add-constraint tool.
 */
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { PluginContext } from "@sbtools/sdk";
import {
  runAddConstraint,
  buildAddConstraintSql,
} from "../../src/tools/generate-add-constraint.js";

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-add-constraint-test-"));
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

describe("buildAddConstraintSql", () => {
  it("generates foreign key constraint with ON DELETE CASCADE", () => {
    const sql = buildAddConstraintSql({
      entityId: "public.orders",
      constraint: {
        name: "orders_user_id_fkey",
        type: "foreign_key",
        columns: ["user_id"],
        references: {
          schema: "public",
          table: "users",
          columns: ["id"],
          onDelete: "CASCADE",
        },
      },
    });

    expect(sql).toContain("ALTER TABLE public.orders");
    expect(sql).toContain("ADD CONSTRAINT orders_user_id_fkey");
    expect(sql).toContain("FOREIGN KEY (user_id)");
    expect(sql).toContain("REFERENCES public.users (id)");
    expect(sql).toContain("ON DELETE CASCADE");
    expect(sql).not.toContain("ON UPDATE");
  });

  it("generates foreign key with ON UPDATE SET NULL", () => {
    const sql = buildAddConstraintSql({
      entityId: "public.items",
      constraint: {
        name: "items_category_fkey",
        type: "foreign_key",
        columns: ["category_id"],
        references: {
          schema: "public",
          table: "categories",
          columns: ["id"],
          onUpdate: "SET NULL",
        },
      },
    });

    expect(sql).toContain("ON UPDATE SET NULL");
    expect(sql).not.toContain("ON DELETE");
  });

  it("generates multi-column foreign key", () => {
    const sql = buildAddConstraintSql({
      entityId: "public.order_items",
      constraint: {
        name: "order_items_order_product_fkey",
        type: "foreign_key",
        columns: ["order_id", "product_id"],
        references: {
          schema: "public",
          table: "orders",
          columns: ["order_id", "product_id"],
        },
      },
    });

    expect(sql).toContain("FOREIGN KEY (order_id, product_id)");
    expect(sql).toContain("REFERENCES public.orders (order_id, product_id)");
  });

  it("generates unique constraint", () => {
    const sql = buildAddConstraintSql({
      entityId: "public.users",
      constraint: {
        name: "users_email_key",
        type: "unique",
        columns: ["email"],
      },
    });

    expect(sql).toContain("ALTER TABLE public.users");
    expect(sql).toContain("ADD CONSTRAINT users_email_key");
    expect(sql).toContain("UNIQUE (email)");
  });

  it("generates check constraint", () => {
    const sql = buildAddConstraintSql({
      entityId: "public.products",
      constraint: {
        name: "products_price_positive",
        type: "check",
        check: "price > 0",
      },
    });

    expect(sql).toContain("ALTER TABLE public.products");
    expect(sql).toContain("ADD CONSTRAINT products_price_positive");
    expect(sql).toContain("CHECK (price > 0)");
  });

  it("throws when FK missing references", () => {
    expect(() =>
      buildAddConstraintSql({
        entityId: "public.orders",
        constraint: { name: "bad_fkey", type: "foreign_key", columns: ["user_id"] },
      })
    ).toThrow("references is required");
  });

  it("throws when FK missing columns", () => {
    expect(() =>
      buildAddConstraintSql({
        entityId: "public.orders",
        constraint: {
          name: "bad_fkey",
          type: "foreign_key",
          references: { schema: "public", table: "users", columns: ["id"] },
        },
      })
    ).toThrow("columns is required");
  });

  it("throws when check constraint missing expression", () => {
    expect(() =>
      buildAddConstraintSql({
        entityId: "public.products",
        constraint: { name: "bad_check", type: "check" },
      })
    ).toThrow("check expression is required");
  });
});

describe("runAddConstraint", () => {
  it("writes migration file and returns sql and filename", async () => {
    const { ctx, migrationsDir } = makeTempCtx();

    const result = await runAddConstraint(ctx, {
      entityId: "public.orders",
      constraint: {
        name: "orders_user_id_fkey",
        type: "foreign_key",
        columns: ["user_id"],
        references: { schema: "public", table: "users", columns: ["id"], onDelete: "CASCADE" },
      },
    });

    expect(result.filename).toMatch(/^\d+_add_constraint_.*\.sql$/);
    const filePath = path.join(migrationsDir, result.filename);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toBe(result.sql + "\n");
  });

  it("works without intent graph", async () => {
    const { ctx } = makeTempCtx();
    const result = await runAddConstraint(ctx, {
      entityId: "public.users",
      constraint: { name: "users_email_key", type: "unique", columns: ["email"] },
    });

    expect(result.sql).toContain("ALTER TABLE");
  });
});
