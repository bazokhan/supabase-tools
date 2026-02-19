/**
 * Tests for studio-introspect tool.
 *
 * The tool queries the live DB via pg_catalog. Tests mock pg.Client to:
 * - Verify system schema exclusion is in the SQL queries
 * - Verify EntityNode construction from column/constraint/index rows
 * - Verify InfraNode construction from extension rows
 * - Verify the artifact is written with correct shape
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { readArtifactOrNull } from "@sbtools/sdk";
import type { PluginContext } from "@sbtools/sdk";
import type { SchemaSnapshotData } from "../../src/artifacts/writers.js";
import { STUDIO_ARTIFACTS } from "../../src/artifacts/constants.js";

// ---------------------------------------------------------------------------
// Hoisted mock setup (vi.mock factory runs before other module-level code)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const connect = vi.fn().mockResolvedValue(undefined);
  const end = vi.fn().mockResolvedValue(undefined);
  // Mutable query handler — tests override this per-test
  let queryImpl: (sql: string) => Promise<{ rows: Record<string, unknown>[] }> =
    async () => ({ rows: [] });

  // Use a regular function so it can be called with `new`
  function ClientConstructor(this: Record<string, unknown>) {
    this["connect"] = connect;
    this["query"] = (sql: string) => queryImpl(sql);
    this["end"] = end;
  }

  return {
    connect,
    end,
    ClientConstructor,
    setQueryImpl(
      impl: (sql: string) => Promise<{ rows: Record<string, unknown>[] }>
    ) {
      queryImpl = impl;
    },
  };
});

vi.mock("pg", () => ({
  default: { Client: mocks.ClientConstructor },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempCtx() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbt-introspect-test-"));
  const sbtDataDir = path.join(dir, ".sbt");
  fs.mkdirSync(sbtDataDir, { recursive: true });
  return {
    ctx: {
      projectRoot: dir,
      sbtDataDir,
      pluginConfig: { dbUrl: "postgresql://localhost/testdb" },
      paths: { migrations: path.join(dir, "migrations") },
    } as unknown as PluginContext,
  };
}

const SYSTEM_SCHEMAS = [
  "auth", "storage", "realtime", "supabase_functions",
  "extensions", "pg_catalog", "pg_toast", "information_schema",
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runIntrospect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to empty result handler
    mocks.setQueryImpl(async () => ({ rows: [] }));
  });

  it("excludes system schemas from all SQL queries", async () => {
    const queryCalls: string[] = [];
    mocks.setQueryImpl(async (sql: string) => {
      queryCalls.push(sql);
      return { rows: [] };
    });

    const { ctx } = makeTempCtx();
    const { runIntrospect } = await import("../../src/tools/introspect.js");
    await runIntrospect(ctx);

    // Verify system schemas appear in NOT IN clauses
    const filterQueries = queryCalls.filter(
      (q) => q.includes("NOT IN") && (q.includes("nspname") || q.includes("table_schema") || q.includes("schemaname"))
    );
    expect(filterQueries.length).toBeGreaterThan(0);
    for (const sql of filterQueries) {
      for (const schema of SYSTEM_SCHEMAS) {
        expect(sql).toContain(`'${schema}'`);
      }
    }
  });

  it("builds EntityNode with correct schema, name and confidence", async () => {
    mocks.setQueryImpl(async (sql: string) => {
      if (sql.includes("information_schema.tables") && !sql.includes("UNION")) {
        return { rows: [{ table_schema: "public", table_name: "users" }] };
      }
      if (sql.includes("information_schema.columns")) {
        return {
          rows: [
            {
              table_schema: "public", table_name: "users",
              column_name: "id", udt_name: "uuid",
              is_nullable: "NO", column_default: null,
              identity_generation: null, generation_expression: null,
            },
            {
              table_schema: "public", table_name: "users",
              column_name: "email", udt_name: "text",
              is_nullable: "NO", column_default: null,
              identity_generation: null, generation_expression: null,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const { ctx } = makeTempCtx();
    const { runIntrospect } = await import("../../src/tools/introspect.js");
    await runIntrospect(ctx);

    const env = readArtifactOrNull<SchemaSnapshotData>(
      ctx,
      STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id,
      STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.version
    );

    expect(env).not.toBeNull();
    const data = env!.data;
    expect(data.entities).toHaveLength(1);

    const entity = data.entities[0];
    expect(entity.id).toBe("public.users");
    expect(entity.schema).toBe("public");
    expect(entity.name).toBe("users");
    expect(entity.managedStatus).toBe("managed");
    expect(entity.confidence).toBe(0.9);
    expect(entity.columns).toHaveLength(2);
    expect(entity.columns[0].name).toBe("id");
    expect(entity.columns[0].type).toBe("uuid");
    expect(entity.columns[0].nullable).toBe(false);
    expect(entity.columns[1].name).toBe("email");
  });

  it("builds InfraNode for extensions", async () => {
    mocks.setQueryImpl(async (sql: string) => {
      if (sql.includes("pg_extension")) {
        return {
          rows: [
            { extname: "uuid-ossp", extversion: "1.1" },
            { extname: "pgcrypto", extversion: "1.3" },
          ],
        };
      }
      return { rows: [] };
    });

    const { ctx } = makeTempCtx();
    const { runIntrospect } = await import("../../src/tools/introspect.js");
    await runIntrospect(ctx);

    const env = readArtifactOrNull<SchemaSnapshotData>(
      ctx,
      STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id,
      STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.version
    );

    const infra = env!.data.infrastructure;
    expect(infra.length).toBeGreaterThanOrEqual(2);
    const uuidExt = infra.find((n) => n.name === "uuid-ossp");
    expect(uuidExt).toBeDefined();
    expect(uuidExt!.type).toBe("extension");
    expect(uuidExt!.details["version"]).toBe("1.1");
  });

  it("writes capturedAt timestamp to artifact", async () => {
    const { ctx } = makeTempCtx();
    const { runIntrospect } = await import("../../src/tools/introspect.js");
    const before = new Date();
    await runIntrospect(ctx);
    const after = new Date();

    const env = readArtifactOrNull<SchemaSnapshotData>(
      ctx,
      STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.id,
      STUDIO_ARTIFACTS.SCHEMA_SNAPSHOT.version
    );

    const ts = new Date(env!.data.capturedAt);
    expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(ts.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("throws DB_CONNECT_ERROR when connection fails", async () => {
    // Temporarily override connect to reject
    mocks.connect.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const { ctx } = makeTempCtx();
    const { runIntrospect } = await import("../../src/tools/introspect.js");
    await expect(runIntrospect(ctx)).rejects.toMatchObject({ code: "DB_CONNECT_ERROR" });
  });
});
