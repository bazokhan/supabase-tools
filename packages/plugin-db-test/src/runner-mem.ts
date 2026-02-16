import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { ui } from "@sbtools/sdk";
import type { SqlExecutor } from "./runner-base.js";
import { runTestSuite } from "./runner-base.js";

// -- SQL statement splitter (respects dollar-quoting, single quotes, comments) --

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;
  let dollarTag = "";
  let inSingleQuote = false;
  let inLineComment = false;
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];
    const nextChar = i + 1 < sql.length ? sql[i + 1] : "";

    if (inLineComment) {
      current += char;
      if (char === "\n") inLineComment = false;
      i++;
      continue;
    }

    if (inSingleQuote) {
      current += char;
      if (char === "'") {
        if (nextChar === "'") {
          current += nextChar;
          i += 2;
          continue;
        }
        inSingleQuote = false;
      }
      i++;
      continue;
    }

    if (char === "$" && !inDollarQuote) {
      let j = i + 1;
      let tag = "";
      while (j < sql.length && sql[j] !== "$") {
        tag += sql[j];
        j++;
      }
      if (j < sql.length && sql[j] === "$") {
        inDollarQuote = true;
        dollarTag = tag;
        current += sql.substring(i, j + 1);
        i = j + 1;
        continue;
      }
    } else if (char === "$" && inDollarQuote) {
      let j = i + 1;
      let tag = "";
      while (j < sql.length && sql[j] !== "$") {
        tag += sql[j];
        j++;
      }
      if (tag === dollarTag && j < sql.length && sql[j] === "$") {
        inDollarQuote = false;
        dollarTag = "";
        current += sql.substring(i, j + 1);
        i = j + 1;
        continue;
      }
    }

    if (!inDollarQuote && char === "-" && nextChar === "-") {
      inLineComment = true;
      current += char + nextChar;
      i += 2;
      continue;
    }

    if (!inDollarQuote && char === "'") {
      inSingleQuote = true;
      current += char;
      i++;
      continue;
    }

    current += char;

    if (char === ";" && !inDollarQuote && !inSingleQuote && !inLineComment) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
    }

    i++;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}

function stripLeadingComments(sql: string): string {
  return sql.replace(/^\s*(--[^\n]*\n\s*)+/g, "").trim();
}

function createMemExecutor(db: PGlite): SqlExecutor {
  return {
    async execute(cleanSql: string): Promise<void> {
      const statements = splitSqlStatements(cleanSql);
      for (const statement of statements) {
        const effective = stripLeadingComments(statement.trim());
        if (!effective) continue;

        try {
          const results = await db.exec(statement.trim());
          for (const result of results) {
            for (const row of result.rows ?? []) {
              for (const value of Object.values(row)) {
                if (typeof value === "string" && value.trim().length > 0) {
                  ui.log(value);
                }
              }
            }
          }
        } catch (error) {
          if (error instanceof Error) {
            ui.error("\nSQL Error Details:");
            ui.error(`Message: ${error.message}`);
          }
          throw error;
        }
      }
    },
  };
}

// -- PGlite environment setup --

async function setupRoles(db: PGlite): Promise<void> {
  await db.exec(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
    END $$;
  `);
}

async function setupAuthSchema(db: PGlite): Promise<void> {
  await db.exec(`CREATE SCHEMA IF NOT EXISTS auth;`);
  await db.exec(`
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid LANGUAGE sql STABLE AS $function$
      SELECT COALESCE(
        NULLIF(current_setting('request.jwt.claim.sub', true), ''),
        (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
      )::uuid
    $function$;
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      encrypted_password TEXT,
      email_confirmed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      raw_user_meta_data JSONB DEFAULT '{}'::jsonb
    );
  `);
}

async function setupCoreFunctions(db: PGlite): Promise<void> {
  await db.exec(`CREATE SCHEMA IF NOT EXISTS extensions;`);
  try {
    await db.exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  } catch {
    /* ok */
  }

  await db.exec(`
    CREATE OR REPLACE FUNCTION public.gen_random_uuid() RETURNS uuid
    LANGUAGE plpgsql AS $$
    DECLARE v text := md5(random()::text || clock_timestamp()::text);
    BEGIN RETURN (substr(v,1,8)||'-'||substr(v,9,4)||'-'||substr(v,13,4)||'-'||substr(v,17,4)||'-'||substr(v,21,12))::uuid; END; $$;
  `);
  await db.exec(`
    CREATE OR REPLACE FUNCTION public.gen_salt(_type text) RETURNS text LANGUAGE sql AS $$
      SELECT substr(md5(random()::text), 1, 22); $$;
  `);
  await db.exec(`
    CREATE OR REPLACE FUNCTION public.crypt(password text, salt text) RETURNS text LANGUAGE sql AS $$
      SELECT 'crypt$' || salt || '$' || password; $$;
  `);
}

async function setupPgTapFunctions(db: PGlite): Promise<void> {
  await db.exec(`CREATE SCHEMA IF NOT EXISTS test;`);
  await db.exec(`CREATE TABLE IF NOT EXISTS test._tap_state (passed integer NOT NULL, failed integer NOT NULL);`);

  await db.exec(`
    CREATE OR REPLACE FUNCTION test._tap_init() RETURNS void LANGUAGE plpgsql AS $$
    BEGIN IF NOT EXISTS (SELECT 1 FROM test._tap_state) THEN INSERT INTO test._tap_state VALUES (0, 0); END IF; END; $$;
  `);
  await db.exec(`
    CREATE OR REPLACE FUNCTION test.plan(expected integer) RETURNS text LANGUAGE plpgsql AS $$
    BEGIN DELETE FROM test._tap_state; INSERT INTO test._tap_state VALUES (0, 0); RETURN '1..' || expected; END; $$;
  `);
  await db.exec(`
    CREATE OR REPLACE FUNCTION test.ok(condition boolean, description text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM test._tap_init();
      IF condition THEN
        UPDATE test._tap_state SET passed = passed + 1;
        RETURN CASE WHEN description IS NULL OR length(trim(description)) = 0 THEN 'ok' ELSE 'ok - ' || description END;
      ELSE
        UPDATE test._tap_state SET failed = failed + 1;
        RETURN CASE WHEN description IS NULL OR length(trim(description)) = 0 THEN 'not ok' ELSE 'not ok - ' || description END;
      END IF;
    END; $$;
  `);
  await db.exec(`
    CREATE OR REPLACE FUNCTION test.is(actual anyelement, expected anyelement, description text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
    BEGIN RETURN test.ok(actual IS NOT DISTINCT FROM expected, description); END; $$;
  `);
  await db.exec(`
    CREATE OR REPLACE FUNCTION test.matches(value text, pattern text, description text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
    BEGIN RETURN test.ok(value ~ pattern, description); END; $$;
  `);
  await db.exec(`
    CREATE OR REPLACE FUNCTION test.finish() RETURNS text LANGUAGE plpgsql AS $$
    DECLARE passed_count integer := 0; failed_count integer := 0; total_count integer := 0;
    BEGIN
      PERFORM test._tap_init();
      SELECT passed, failed INTO passed_count, failed_count FROM test._tap_state LIMIT 1;
      total_count := passed_count + failed_count;
      RETURN '# Test Summary: ' || passed_count || ' passed, ' || failed_count || ' failed out of ' || total_count || ' tests';
    END; $$;
  `);
}

async function loadMigrations(db: PGlite, migrationsDir: string): Promise<void> {
  if (!fs.existsSync(migrationsDir)) {
    ui.info("No migrations directory found, skipping.");
    return;
  }
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file: string) => file.endsWith(".sql"))
    .sort();

  ui.step(`Loading ${migrationFiles.length} migrations...`);

  for (const file of migrationFiles) {
    let content = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    content = content.replace(/CREATE\s+EXTENSION\s+(IF\s+NOT\s+EXISTS\s+)?pgtap[^;]*;/gi, "-- pgtap handled by runner");
    content = content.replace(/ALTER\s+EXTENSION\s+pgtap[^;]*;/gi, "-- pgtap handled by runner");
    content = content.replace(/ALTER\s+PUBLICATION\s+supabase_realtime[^;]*;/gi, "-- publication skipped");
    await db.exec(content);
  }

  ui.success("Migrations loaded\n");
}

export async function runMemTests(testsDir: string, migrationsDir: string): Promise<void> {
  const db = new PGlite("memory://");
  await db.waitReady;

  await db.exec("SET search_path TO test, public, extensions");
  await db.exec("SET row_security = off");

  await setupRoles(db);
  await setupCoreFunctions(db);
  await setupAuthSchema(db);
  await setupPgTapFunctions(db);
  ui.success("Auth schema + pgTAP shims ready\n");

  await loadMigrations(db, migrationsDir);

  await db.exec("SET search_path TO test, public, extensions");

  const executor = createMemExecutor(db);
  await runTestSuite(executor, testsDir, "Running Database Tests (In-Memory PGlite)");
}
