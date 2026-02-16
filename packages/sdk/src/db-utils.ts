/**
 * Shared DB client utilities. Plugins that need DB access must have `pg` installed.
 * If `pg` is not available, functions throw a descriptive error.
 */
import { createRequire } from "node:module";
import { SbtError } from "./errors.js";

const require = createRequire(import.meta.url);

/** Resolve DB URL from env vars or default. */
export function resolveDbUrl(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    "postgresql://postgres:postgres@localhost:54322/postgres"
  );
}

/** Create a pg.Client. Throws if `pg` is not installed. */
export function createPgClient(): import("pg").Client {
  try {
    const { Client } = require("pg") as typeof import("pg");
    return new Client({ connectionString: resolveDbUrl() });
  } catch {
    throw new SbtError("COMMAND_FAILED", "pg package is required for database operations.", {
      tips: ["Install it: npm install pg"],
    });
  }
}

/** Test connection. Returns true if successful. */
export async function testConnection(
  client: import("pg").Client
): Promise<boolean> {
  try {
    await client.connect();
    return true;
  } catch {
    return false;
  }
}

/** Safe disconnect. */
export async function disconnectClient(
  client: import("pg").Client
): Promise<void> {
  try {
    await client.end();
  } catch (err) {
    if (process.env.SBT_DEBUG === "1") {
      console.warn(`disconnectClient failed: ${(err as Error).message}`);
    }
  }
}
