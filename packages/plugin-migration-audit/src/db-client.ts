/**
 * pg.Client wrapper — all DB queries (read-only).
 */
import { Client } from "pg";
import type { AppliedMigration, SchemaSnapshot } from "./types.js";

/** Resolve DB URL from env vars or default. */
export function resolveDbUrl(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    "postgresql://postgres:postgres@localhost:54322/postgres"
  );
}

/** Create a pg.Client with the resolved connection string. */
export function createClient(): Client {
  return new Client({ connectionString: resolveDbUrl() });
}

/** Test connection by calling connect(). Returns true if successful. */
export async function testConnection(client: Client): Promise<boolean> {
  try {
    await client.connect();
    return true;
  } catch {
    return false;
  }
}

/** Check if app_migrations.schema_migrations table exists. */
export async function checkTrackingTable(client: Client): Promise<boolean> {
  const result = await client.query<{ count: string }>(
    `SELECT count(*) AS count
     FROM information_schema.tables
     WHERE table_schema = 'app_migrations' AND table_name = 'schema_migrations'`
  );
  return Number(result.rows[0]?.count ?? 0) > 0;
}

/** Get applied migrations from app_migrations.schema_migrations. */
export async function getAppliedMigrations(client: Client): Promise<AppliedMigration[]> {
  const result = await client.query<{ version: string; applied_at: Date }>(
    `SELECT version, applied_at FROM app_migrations.schema_migrations ORDER BY version`
  );
  return result.rows.map((r) => ({
    version: r.version,
    appliedAt: r.applied_at,
  }));
}

/** Get schema snapshot: tables, schemas, counts, size, version. */
export async function getSchemaSnapshot(client: Client): Promise<SchemaSnapshot> {
  const [
    tablesResult,
    schemasResult,
    funcResult,
    triggerResult,
    policyResult,
    viewResult,
    sizeResult,
    versionResult,
  ] = await Promise.all([
    client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    ),
    client.query<{ schema_name: string }>(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema') ORDER BY schema_name`
    ),
    client.query<{ count: string }>(
      `SELECT count(*) AS count FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')`
    ),
    client.query<{ count: string }>(
      `SELECT count(*) AS count FROM information_schema.triggers`
    ),
    client.query<{ count: string }>(
      `SELECT count(*) AS count FROM pg_policies`
    ),
    client.query<{ count: string }>(
      `SELECT count(*) AS count FROM information_schema.views WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`
    ),
    client.query<{ size: string }>(
      `SELECT pg_size_pretty(pg_database_size(current_database())) AS size`
    ),
    client.query<{ version: string }>(`SELECT version() AS version`),
  ]);

  return {
    publicTableCount: tablesResult.rows.length,
    publicTableNames: tablesResult.rows.map((r) => r.tablename),
    schemas: schemasResult.rows.map((r) => r.schema_name),
    functionCount: Number(funcResult.rows[0]?.count ?? 0),
    triggerCount: Number(triggerResult.rows[0]?.count ?? 0),
    policyCount: Number(policyResult.rows[0]?.count ?? 0),
    viewCount: Number(viewResult.rows[0]?.count ?? 0),
    dbSize: sizeResult.rows[0]?.size ?? null,
    pgVersion: versionResult.rows[0]?.version ?? null,
  };
}

/** Safe disconnect. */
export async function disconnectClient(client: Client): Promise<void> {
  try {
    await client.end();
  } catch {
    // ignore
  }
}
