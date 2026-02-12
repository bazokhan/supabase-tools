import fs from "node:fs";
import path from "node:path";

/** Read a SQL test file relative to testsDir. */
export function readSqlFile(testsDir: string, filePath: string): string {
  const fullPath = path.resolve(testsDir, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Test file not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, "utf8");
}

/** Recursively discover all .sql test files under testsDir, sorted. */
export function discoverTestFiles(testsDir: string): string[] {
  if (!fs.existsSync(testsDir)) return [];

  const results: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".sql") && !entry.name.startsWith("_")) {
        results.push(path.relative(testsDir, full));
      }
    }
  };
  walk(testsDir);
  return results.sort();
}

/**
 * Pre-process SQL content: resolve \i includes, convert \echo to comments,
 * strip \set commands. Works recursively for nested includes.
 */
export function processSqlFile(content: string, baseDir: string): string {
  const lines = content.split("\n");
  const processed: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    const includeMatch = trimmedLine.match(/^\\i\s+(.+)$/);
    if (includeMatch) {
      const includePath = includeMatch[1].trim();
      const cleanPath = includePath.replace(/^['"]|['"]$/g, "");
      const resolvedPath = path.isAbsolute(cleanPath)
        ? cleanPath
        : path.resolve(baseDir, cleanPath);

      const normalizedPath = path.normalize(resolvedPath);

      if (!fs.existsSync(normalizedPath)) {
        throw new Error(
          `Included file not found: ${normalizedPath}\n` +
            `  Base directory: ${baseDir}\n` +
            `  Include path: ${cleanPath}\n` +
            `  Original line: ${line}`
        );
      }

      const includedContent = fs.readFileSync(normalizedPath, "utf8");
      const processedInclude = processSqlFile(
        includedContent,
        path.dirname(normalizedPath),
      );
      processed.push(processedInclude);
      i++;
      continue;
    }

    const echoMatch = trimmedLine.match(/^\\echo\s+(.+)$/);
    if (echoMatch) {
      processed.push(`-- ECHO: ${echoMatch[1].trim()}`);
      i++;
      continue;
    }

    if (trimmedLine.match(/^\\set\s+/)) {
      i++;
      continue;
    }

    processed.push(line);
    i++;
  }

  return processed.join("\n");
}

/** Check for unprocessed backslash commands that would fail in pg client. */
export function checkBackslashCommands(sql: string): string[] {
  const problems: string[] = [];
  const lines = sql.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("--")) continue;
    if (line.match(/^\\[a-z]/i) && !line.includes("$$")) {
      problems.push(`Line ${i + 1}: ${line}`);
    }
  }
  return problems;
}

/** Extract echo markers from processed SQL and print them. Returns clean SQL. */
export function extractEchoMarkers(sql: string): { cleanSql: string; echoes: string[] } {
  const lines = sql.split("\n");
  const sqlLines: string[] = [];
  const echoes: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith("-- ECHO:")) {
      echoes.push(line.trim().replace("-- ECHO:", "").trim());
    } else {
      sqlLines.push(line);
    }
  }

  return { cleanSql: sqlLines.join("\n"), echoes };
}
