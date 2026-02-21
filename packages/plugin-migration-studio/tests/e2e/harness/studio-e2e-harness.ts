import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PluginContext } from "@sbtools/sdk";
import { createPgClient, disconnectClient, readArtifactOrNull, testConnection } from "@sbtools/sdk";

export const STRICT_DB_ENV = "SBT_STUDIO_E2E_REQUIRE_DB";

export interface TempStudioContext {
  ctx: PluginContext;
  root: string;
}

export interface ArtifactRef {
  id: string;
  version: string;
}

export function createTempStudioContext(prefix = "sbt-studio-e2e-"): TempStudioContext {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const sbtDataDir = path.join(root, ".sbt");
  const artifactsDir = path.join(sbtDataDir, "artifacts");
  const migrations = path.join(root, "supabase", "migrations");
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.mkdirSync(migrations, { recursive: true });

  return {
    root,
    ctx: {
      projectRoot: root,
      toolsDir: root,
      sbtDataDir,
      artifactsDir,
      apiUrl: "http://localhost:54321",
      pluginConfig: {},
      paths: {
        migrations,
        snapshot: path.join(root, "supabase", "snapshot"),
        docsOutput: path.join(root, "docs"),
        functions: path.join(root, "supabase", "functions"),
      },
    },
  };
}

export function cleanupTempStudioContext(root: string): void {
  fs.rmSync(root, { recursive: true, force: true });
}

export function isStrictDbMode(): boolean {
  const value = process.env[STRICT_DB_ENV]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export async function isDbAvailable(): Promise<boolean> {
  const client = createPgClient();
  try {
    const ok = await testConnection(client);
    await disconnectClient(client).catch(() => undefined);
    return ok;
  } catch {
    await disconnectClient(client).catch(() => undefined);
    return false;
  }
}

export async function requireDbOrWarn(suiteName: string): Promise<boolean> {
  const ok = await isDbAvailable();
  if (ok) return true;

  const message =
    `[${suiteName}] DB is not reachable. Start local stack with \`sbt start\` to run DB E2E workflows.`;
  if (isStrictDbMode()) {
    throw new Error(`${message} Strict mode is enabled via ${STRICT_DB_ENV}=1.`);
  }

  console.warn(message);
  return false;
}

export async function withDbClient<T>(fn: (client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }) => Promise<T>): Promise<T> {
  const client = createPgClient();
  await client.connect();
  try {
    return await fn(client as unknown as { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> });
  } finally {
    await disconnectClient(client).catch(() => undefined);
  }
}

export function readArtifactDataOrThrow<T>(ctx: PluginContext, artifact: ArtifactRef): T {
  const env = readArtifactOrNull<T>(ctx, artifact.id, artifact.version);
  if (!env?.data) throw new Error(`Missing artifact ${artifact.id}@${artifact.version}`);
  return env.data;
}

export function listMigrationFiles(ctx: PluginContext): string[] {
  if (!fs.existsSync(ctx.paths.migrations)) return [];
  return fs
    .readdirSync(ctx.paths.migrations)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

export function readMigrationFile(ctx: PluginContext, filename: string): string {
  return fs.readFileSync(path.join(ctx.paths.migrations, filename), "utf8");
}

export function writeMigrationFile(ctx: PluginContext, filename: string, sql: string): void {
  fs.writeFileSync(path.join(ctx.paths.migrations, filename), sql.endsWith("\n") ? sql : `${sql}\n`, "utf8");
}

export function uniqueName(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

export async function execSql(sql: string): Promise<void> {
  await withDbClient(async (client) => {
    await client.query(sql);
  });
}

export async function tableExists(schema: string, table: string): Promise<boolean> {
  return withDbClient(async (client) => {
    const fq = `${schema}.${table}`;
    const result = await client.query("select to_regclass($1) as rel", [fq]);
    return Boolean(result.rows[0]?.rel);
  });
}

export async function tableRlsEnabled(schema: string, table: string): Promise<boolean> {
  return withDbClient(async (client) => {
    const result = await client.query(
      `select c.relrowsecurity as enabled
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = $1 and c.relname = $2`,
      [schema, table]
    );
    return Boolean(result.rows[0]?.enabled);
  });
}

export async function policyExists(schema: string, table: string, policyName: string): Promise<boolean> {
  return withDbClient(async (client) => {
    const result = await client.query(
      `select 1
       from pg_policies
       where schemaname = $1 and tablename = $2 and policyname = $3
       limit 1`,
      [schema, table, policyName]
    );
    return result.rows.length > 0;
  });
}
