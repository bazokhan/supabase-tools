/**
 * pg_stat_statements integration via `docker exec psql`.
 *
 * Zero external dependencies -- queries Postgres by shelling out to psql
 * inside the running database container.
 */
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueryStat {
  query: string;
  calls: number;
  total_exec_time_ms: number;
  mean_exec_time_ms: number;
  rows: number;
  hit_rate: string;
}

export interface PgStatsSnapshot {
  available: boolean;
  error?: string;
  total_tracked: number;
  queries: QueryStat[];
}

// ---------------------------------------------------------------------------
// Shell helper
// ---------------------------------------------------------------------------

/** Field separator for psql tuple output — avoids collisions with SQL text. */
const SEP = "\x01";

function psql(
  dbContainer: string,
  sql: string,
): { ok: boolean; stdout: string; error?: string } {
  // Collapse to single line to avoid cmd.exe newline issues on Windows
  const oneLine = sql.replace(/\s+/g, " ").trim();
  try {
    const stdout = execSync(
      `docker exec "${dbContainer}" psql -U postgres -d postgres -At -F "${SEP}" -c "${oneLine.replace(/"/g, '\\"')}"`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 10_000 },
    ).trim();
    return { ok: true, stdout };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    return { ok: false, stdout: "", error: message };
  }
}

// ---------------------------------------------------------------------------
// Extension bootstrap
// ---------------------------------------------------------------------------

export function ensureExtension(dbContainer: string): {
  ok: boolean;
  error?: string;
} {
  const res = psql(
    dbContainer,
    "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;",
  );
  if (!res.ok) {
    // Check if it's a shared_preload_libraries issue
    if (
      res.error?.includes("shared_preload_libraries") ||
      res.error?.includes("not available")
    ) {
      return {
        ok: false,
        error:
          "pg_stat_statements requires shared_preload_libraries to be configured.\n" +
          "The Supabase Postgres image should include this by default.\n" +
          "If you see this error, ensure you are using supabase/postgres:17+ image.",
      };
    }
    return { ok: false, error: res.error };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

function parseRows(raw: string): QueryStat[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .filter((line) => line.includes(SEP))
    .map((line) => {
      const parts = line.split(SEP).map((p) => p.trim());
      return {
        query: parts[0] ?? "",
        calls: parseInt(parts[1] ?? "0", 10),
        total_exec_time_ms: parseFloat(parts[2] ?? "0"),
        mean_exec_time_ms: parseFloat(parts[3] ?? "0"),
        rows: parseInt(parts[4] ?? "0", 10),
        hit_rate: parts[5] ?? "n/a",
      };
    });
}

const BASE_SELECT = `
SELECT
  left(query, 120) AS query,
  calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  rows,
  CASE WHEN shared_blks_hit + shared_blks_read > 0
    THEN round(100.0 * shared_blks_hit / (shared_blks_hit + shared_blks_read), 1) || '%'
    ELSE 'n/a'
  END AS hit_rate
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
  AND query NOT LIKE '%BEGIN%'
  AND query NOT LIKE '%COMMIT%'
`.trim();

export function getTopQueries(
  dbContainer: string,
  limit = 20,
): PgStatsSnapshot {
  const ext = ensureExtension(dbContainer);
  if (!ext.ok)
    return { available: false, error: ext.error, total_tracked: 0, queries: [] };

  const countRes = psql(
    dbContainer,
    "SELECT count(*) FROM pg_stat_statements;",
  );
  const total = parseInt(countRes.stdout || "0", 10);

  const res = psql(
    dbContainer,
    `${BASE_SELECT} ORDER BY total_exec_time DESC NULLS LAST LIMIT ${limit};`,
  );
  if (!res.ok)
    return {
      available: false,
      error: res.error,
      total_tracked: total,
      queries: [],
    };

  return { available: true, total_tracked: total, queries: parseRows(res.stdout) };
}

export function getSlowQueries(
  dbContainer: string,
  limit = 20,
): PgStatsSnapshot {
  const ext = ensureExtension(dbContainer);
  if (!ext.ok)
    return { available: false, error: ext.error, total_tracked: 0, queries: [] };

  const countRes = psql(
    dbContainer,
    "SELECT count(*) FROM pg_stat_statements;",
  );
  const total = parseInt(countRes.stdout || "0", 10);

  const res = psql(
    dbContainer,
    `${BASE_SELECT} ORDER BY mean_exec_time DESC NULLS LAST LIMIT ${limit};`,
  );
  if (!res.ok)
    return {
      available: false,
      error: res.error,
      total_tracked: total,
      queries: [],
    };

  return { available: true, total_tracked: total, queries: parseRows(res.stdout) };
}

export function getFrequentQueries(
  dbContainer: string,
  limit = 20,
): PgStatsSnapshot {
  const ext = ensureExtension(dbContainer);
  if (!ext.ok)
    return { available: false, error: ext.error, total_tracked: 0, queries: [] };

  const countRes = psql(
    dbContainer,
    "SELECT count(*) FROM pg_stat_statements;",
  );
  const total = parseInt(countRes.stdout || "0", 10);

  const res = psql(
    dbContainer,
    `${BASE_SELECT} ORDER BY calls DESC NULLS LAST LIMIT ${limit};`,
  );
  if (!res.ok)
    return {
      available: false,
      error: res.error,
      total_tracked: total,
      queries: [],
    };

  return { available: true, total_tracked: total, queries: parseRows(res.stdout) };
}

export function resetStats(dbContainer: string): { ok: boolean; error?: string } {
  const ext = ensureExtension(dbContainer);
  if (!ext.ok) return ext;
  const res = psql(dbContainer, "SELECT pg_stat_statements_reset();");
  return res.ok
    ? { ok: true }
    : { ok: false, error: res.error };
}

// ---------------------------------------------------------------------------
// Formatting helpers for CLI output
// ---------------------------------------------------------------------------

export function formatStatsTable(snapshot: PgStatsSnapshot): string {
  if (!snapshot.available) {
    return `pg_stat_statements not available: ${snapshot.error ?? "unknown error"}`;
  }
  if (snapshot.queries.length === 0) {
    return `No query statistics collected yet (${snapshot.total_tracked} total tracked).`;
  }

  const header =
    "  " +
    "Query".padEnd(60) +
    "Calls".padStart(10) +
    "Total(ms)".padStart(12) +
    "Mean(ms)".padStart(12) +
    "Rows".padStart(10) +
    "Hit%".padStart(8);

  const sep = "  " + "-".repeat(112);

  const rows = snapshot.queries.map((q) => {
    const queryTrunc =
      q.query.length > 57 ? q.query.substring(0, 57) + "..." : q.query;
    return (
      "  " +
      queryTrunc.padEnd(60) +
      String(q.calls).padStart(10) +
      q.total_exec_time_ms.toFixed(2).padStart(12) +
      q.mean_exec_time_ms.toFixed(2).padStart(12) +
      String(q.rows).padStart(10) +
      q.hit_rate.padStart(8)
    );
  });

  return [
    `\npg_stat_statements — ${snapshot.total_tracked} queries tracked\n`,
    header,
    sep,
    ...rows,
    "",
  ].join("\n");
}
