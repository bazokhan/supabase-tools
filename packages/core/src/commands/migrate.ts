import fs from "node:fs";
import path from "node:path";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { ui, sanitizeContainerPrefix } from "@sbtools/sdk";
import { config, resolve } from "../config.js";

export async function runMigrate(): Promise<void> {
  const MIGRATIONS_DIR = resolve(config.paths.migrations);

  const prefix = sanitizeContainerPrefix(config.project.name);
  const DB_CONTAINER = `${prefix}-supabase-db`;

  const sleep = (ms: number): void => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  };

  const run = (args: string[], input?: string): string => {
    const res: SpawnSyncReturns<string> = spawnSync("docker", args, {
      input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
    });
    if (res.status !== 0) {
      const msg = res.stderr?.trim() || res.stdout?.trim() || "Unknown error";
      throw new Error(msg);
    }
    return res.stdout ?? "";
  };

  const psql = (sql: string): string =>
    run(["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], sql);

  const psqlQuery = (sql: string): string =>
    run(["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], "");

  const waitForDb = (timeoutMs: number = 60000): void => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = spawnSync("docker", ["exec", DB_CONTAINER, "pg_isready", "-U", "postgres"], { encoding: "utf8" });
      if (res.status === 0) return;
      sleep(1000);
    }
    throw new Error("Timed out waiting for database to be ready.");
  };

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    ui.info(`No migrations directory found at ${MIGRATIONS_DIR}`);
    return;
  }

  const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
    .filter((name: string) => name.endsWith(".sql")).sort();

  if (migrationFiles.length === 0) {
    ui.info("No migration files found.");
    return;
  }

  waitForDb();

  psql(`
CREATE SCHEMA IF NOT EXISTS app_migrations;
CREATE TABLE IF NOT EXISTS app_migrations.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
`);

  const appliedRaw = psqlQuery("SELECT version FROM app_migrations.schema_migrations ORDER BY version;");
  const applied = new Set(appliedRaw.split(/\r?\n/).map((v: string) => v.trim()).filter(Boolean));

  const appliedCountRaw = psqlQuery("SELECT count(*) FROM app_migrations.schema_migrations;");
  const appliedCount = Number(appliedCountRaw.trim() || "0");
  const publicTableCountRaw = psqlQuery("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';");
  const publicTableCount = Number(publicTableCountRaw.trim() || "0");

  if (process.env.MIGRATION_BASELINE === "1") {
    for (const file of migrationFiles) {
      const version = file.replace(/'/g, "''");
      psql(`INSERT INTO app_migrations.schema_migrations (version) VALUES ('${version}') ON CONFLICT DO NOTHING;`);
    }
    ui.success("Baseline complete: recorded all migrations without applying.");
    return;
  }

  if (appliedCount === 0 && publicTableCount > 0 && process.env.MIGRATION_REAPPLY !== "1") {
    for (const file of migrationFiles) {
      const version = file.replace(/'/g, "''");
      psql(`INSERT INTO app_migrations.schema_migrations (version) VALUES ('${version}') ON CONFLICT DO NOTHING;`);
    }
    ui.info("Database already has public tables; recorded migrations as applied. Set MIGRATION_REAPPLY=1 to force apply.");
    return;
  }

  let appliedNowCount = 0;
  for (const file of migrationFiles) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    ui.step(`Applying ${file}...`);
    psql(sql);
    const version = file.replace(/'/g, "''");
    psql(`INSERT INTO app_migrations.schema_migrations (version) VALUES ('${version}');`);
    appliedNowCount += 1;
  }

  if (appliedNowCount === 0) {
    ui.info("Migrations already up to date.");
  } else {
    ui.success(`Applied ${appliedNowCount} migration(s).`);
  }
}
