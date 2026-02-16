import { Client } from "pg";
import { ui, DatabaseError } from "@sbtools/sdk";
import type { SqlExecutor } from "./runner-base.js";
import { runTestSuite } from "./runner-base.js";

async function createLiveExecutor(client: Client): Promise<SqlExecutor> {
  return {
    async execute(cleanSql: string): Promise<void> {
      try {
        const result = await client.query(cleanSql);
        if (result.rows && result.rows.length > 0) {
          for (const row of result.rows) {
            for (const value of Object.values(row)) {
              if (typeof value === "string" && value.trim().length > 0) {
                ui.log(value);
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes("NOTICE:")) {
            const noticeMatch = error.message.match(/NOTICE:\s+(.+)/);
            if (noticeMatch) ui.log(noticeMatch[1]);
            return;
          }
          ui.error("\nSQL Error Details:");
          ui.error(`Message: ${error.message}`);
          if (error.message.includes("ambiguous")) {
            ui.warn("Tip: Qualify column names with table aliases (e.g., table.column)");
          }
        }
        throw error;
      }
    },
  };
}

export async function runLiveTests(dbUrl: string, testsDir: string): Promise<void> {
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    ui.success("Connected to database\n");

    await client.query("SET search_path TO test, public, extensions");

    const extCheck = await client.query(
      `SELECT EXISTS(
        SELECT 1 FROM pg_extension e
        JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname = 'pgtap' AND n.nspname = 'test'
      ) as exists`,
    );
    if (!extCheck.rows[0]?.exists) {
      throw new DatabaseError('pgTAP extension not installed in schema "test".', {
        tips: ["Install pgtap: CREATE EXTENSION pgtap SCHEMA test;"],
      });
    }
    ui.info("pgTAP extension found\n");

    const executor = await createLiveExecutor(client);
    await runTestSuite(executor, testsDir, "Running Database Function Tests");
  } finally {
    await client.end();
  }
}
