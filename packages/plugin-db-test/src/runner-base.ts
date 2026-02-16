/**
 * Shared test suite orchestration for live (pg) and in-memory (PGlite) runners.
 * Discovers test files, processes SQL, validates backslash commands, and delegates
 * execution to a SqlExecutor.
 */
import path from "node:path";
import { ui, SbtError } from "@sbtools/sdk";
import { readSqlFile, discoverTestFiles, processSqlFile, checkBackslashCommands, extractEchoMarkers } from "./test-utils.js";

export interface SqlExecutor {
  /** Execute processed, cleaned SQL. Responsible for splitting if needed (e.g. PGlite) and error handling. */
  execute(cleanSql: string): Promise<void>;
}

/**
 * Run the test suite: discover files, process each, execute via the provided executor.
 */
export async function runTestSuite(
  executor: SqlExecutor,
  testsDir: string,
  suiteLabel: string,
): Promise<void> {
  ui.heading("========================================");
  ui.heading(suiteLabel);
  ui.heading("========================================\n");

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

    const { cleanSql, echoes } = extractEchoMarkers(processedTest);
    for (const msg of echoes) ui.log(msg);

    const problems = checkBackslashCommands(cleanSql);
    if (problems.length > 0) {
      throw new SbtError("COMMAND_FAILED", `Found unprocessed backslash commands in SQL:\n${problems.join("\n")}`, {
        tips: ["These commands need to be processed before execution."],
      });
    }

    await executor.execute(cleanSql);
    ui.blank();
  }

  ui.heading("========================================");
  ui.success("All tests completed!");
  ui.heading("========================================");
}
