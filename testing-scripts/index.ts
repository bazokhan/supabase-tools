/**
 * sbt onboarding test runner
 *
 * Usage:
 *   npx tsx testing-scripts/index.ts --target /absolute/path/to/empty-or-existing-folder
 *
 * Each test runs against the target directory with a clean slate (sbt-generated
 * files stripped before each test). The target's node_modules, package.json,
 * and any other user files are left untouched.
 *
 * No build or publish of local packages is required — the local TypeScript
 * source is run directly via tsx.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clean, log } from "./utils.js";

// ---------------------------------------------------------------------------
// Test registry — add new tests here
// ---------------------------------------------------------------------------

import * as t01 from "./tests/01-help-no-config.js";
import * as t02 from "./tests/02-init-fresh.js";
import * as t03 from "./tests/03-init-existing.js";
import * as t04 from "./tests/04-migrate-preflight.js";
import * as t05 from "./tests/05-help-with-config.js";
import * as t06 from "./tests/06-plugin-list.js";
import * as t07 from "./tests/07-plugin-add.js";
import * as t08 from "./tests/08-plugin-disable-enable.js";
import * as t09 from "./tests/09-plugin-remove.js";
import * as t10 from "./tests/10-plugin-no-config.js";

const TESTS: Array<{ name: string; run: (dir: string) => void }> = [
  t01, t02, t03, t04, t05, t06, t07, t08, t09, t10,
];

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(): { targetDir: string } {
  const args = process.argv.slice(2);
  const targetIdx = args.indexOf("--target");
  if (targetIdx === -1 || !args[targetIdx + 1]) {
    console.error("Usage: npx tsx testing-scripts/index.ts --target <absolute-path>");
    console.error("Example: npx tsx testing-scripts/index.ts --target /tmp/my-sbt-test");
    process.exit(1);
  }
  const targetDir = path.resolve(args[targetIdx + 1]);
  return { targetDir };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  const { targetDir } = parseArgs();

  // Validate target directory
  if (!fs.existsSync(targetDir)) {
    console.error(`Target directory does not exist: ${targetDir}`);
    console.error("Create it first, then re-run.");
    process.exit(1);
  }
  if (!fs.statSync(targetDir).isDirectory()) {
    console.error(`Target path is not a directory: ${targetDir}`);
    process.exit(1);
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`  sbt onboarding test suite`);
  console.log(`  target: ${targetDir}`);
  console.log(`  tests:  ${TESTS.length}`);
  console.log(`${"=".repeat(70)}`);

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (let i = 0; i < TESTS.length; i++) {
    const test = TESTS[i];
    log.heading(`[${i + 1}/${TESTS.length}] ${test.name}`);

    // Reset the target directory to a blank state before each test
    clean(targetDir);

    try {
      test.run(targetDir);
      log.pass("PASSED");
      passed++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.fail(`FAILED — ${message}`);
      failures.push(`[${i + 1}] ${test.name}\n       ${message}`);
      failed++;
    }
  }

  // Final clean-up
  clean(targetDir);

  // Summary
  console.log(`\n${"=".repeat(70)}`);
  if (failed === 0) {
    console.log(`  \x1b[32m✓ All ${passed} tests passed\x1b[0m`);
  } else {
    console.log(`  \x1b[31m✗ ${failed} failed\x1b[0m, \x1b[32m${passed} passed\x1b[0m`);
    console.log(`\nFailures:`);
    for (const f of failures) console.log(`  ${f}`);
  }
  console.log(`${"=".repeat(70)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
