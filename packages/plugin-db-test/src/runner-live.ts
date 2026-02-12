import path from "node:path";
import { Client } from "pg";
import { ui } from "@sbtools/sdk";
import {
  readSqlFile, discoverTestFiles, processSqlFile,
  checkBackslashCommands, extractEchoMarkers,
} from "./test-utils.js";

async function executeSql(client: Client, sql: string): Promise<void> {
  const { cleanSql, echoes } = extractEchoMarkers(sql);
  for (const msg of echoes) ui.log(msg);

  const problems = checkBackslashCommands(cleanSql);
  if (problems.length > 0) {
    throw new Error(
      `Found unprocessed backslash commands in SQL:\n${problems.join("\n")}\n\nThese commands need to be processed before execution.`
    );
  }

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
}

export async function runLiveTests(dbUrl: string, testsDir: string): Promise<void> {
  ui.heading("========================================");
  ui.heading("Running Database Function Tests");
  ui.heading("========================================\n");

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
      ) as exists`
    );
    if (!extCheck.rows[0]?.exists) {
      throw new Error('pgTAP extension not installed in schema "test".');
    }
    ui.info("pgTAP extension found\n");

    const testFiles = discoverTestFiles(testsDir);
    if (testFiles.length === 0) {
      ui.info("No test files found.");
      return;
    }

    for (const testFile of testFiles) {
      const label = testFile.replace(/^functions\/test_/, "").replace(/\.sql$/, "");
      ui.heading(`Testing: ${label}`);
      ui.log("----------------------------------------");

      const testContent = readSqlFile(testsDir, testFile);
      const testFileDir = path.dirname(path.resolve(testsDir, testFile));
      const processedTest = processSqlFile(testContent, testFileDir);
      await executeSql(client, processedTest);
      ui.blank();
    }

    ui.heading("========================================");
    ui.success("All tests completed!");
    ui.heading("========================================");
  } finally {
    await client.end();
  }
}
