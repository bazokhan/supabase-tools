/**
 * Custom convention linter for supabase-tools.
 *
 * Scans packages/star/src/star-star/star.ts for violations of project conventions
 * established during the refactoring. Emits warnings to stderr — does NOT
 * fail the build (exit 0 always).
 *
 * Run: `npx tsx scripts/lint-conventions.ts`
 */

import fs from "node:fs";
import path from "node:path";

// ── Types ────────────────────────────────────────────────────────────────────

interface Rule {
  id: string;
  description: string;
  /** Return warning messages for this file, or empty array. */
  check(filePath: string, content: string, lines: string[]): string[];
}

interface Warning {
  rule: string;
  file: string;
  line: number;
  message: string;
}

// ── File discovery ───────────────────────────────────────────────────────────

const ROOT = path.resolve(import.meta.dirname, "..");
const PACKAGES_DIR = path.join(ROOT, "packages");

function walk(dir: string, ext: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

function discoverSourceFiles(): string[] {
  const files: string[] = [];
  for (const pkg of fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    const srcDir = path.join(PACKAGES_DIR, pkg.name, "src");
    if (fs.existsSync(srcDir)) {
      files.push(...walk(srcDir, ".ts"));
    }
  }
  return files;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function relPath(absPath: string): string {
  return path.relative(ROOT, absPath).replace(/\\/g, "/");
}

/** True if the file is inside sdk/src (where console.log is the implementation). */
function isSdkUi(filePath: string): boolean {
  return relPath(filePath).startsWith("packages/sdk/src/ui.ts");
}

/** True if the file is the sdk error module (where process.exit is legitimate). */
function isSdkErrors(filePath: string): boolean {
  return relPath(filePath).startsWith("packages/sdk/src/errors.ts");
}

/** True if the file is a template that generates code for scaffolded plugins. */
function isTemplate(filePath: string): boolean {
  return relPath(filePath).includes("/templates/");
}

/** True if the file is the core CLI entrypoint. */
function isCliEntrypoint(filePath: string): boolean {
  return relPath(filePath).endsWith("core/src/cli.ts");
}

/** True if the file is an atlas bootstrap JS string (runs in browser context). */
function isAtlasBrowserCode(filePath: string): boolean {
  const rel = relPath(filePath);
  return rel.includes("/atlas/") && !rel.includes("/atlas.ts");
}

// ── Rules ────────────────────────────────────────────────────────────────────

const rules: Rule[] = [
  // R1: Use ui.* instead of console.log/warn/error
  {
    id: "no-console",
    description: "Use `ui.*` from @sbtools/sdk instead of console.log/warn/error",
    check(filePath, _content, lines) {
      if (isSdkUi(filePath) || isTemplate(filePath)) return [];
      // Allow console.warn in db-utils.ts disconnect guard (fire-and-forget)
      const isDbUtils = relPath(filePath).endsWith("sdk/src/db-utils.ts");
      // Allow SBT_DEBUG-gated console.warn in migration-studio server
      const isMigrationStudioServer = relPath(filePath).endsWith("plugin-migration-studio/src/server.ts");
      const warnings: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/console\.(log|error|warn)\s*\(/.test(line)) {
          // Known exceptions
          if (isDbUtils && line.includes("disconnectClient failed")) continue;
          if (isMigrationStudioServer && line.includes("SBT_DEBUG")) continue;
          warnings.push(`${i + 1}: ${line.trim()}`);
        }
      }
      return warnings;
    },
  },

  // R2: Use SbtError subclasses instead of bare `new Error()`
  {
    id: "no-bare-error",
    description: "Use SbtError/ConfigError/DatabaseError/SnapshotError instead of `new Error()`",
    check(filePath, _content, lines) {
      // Atlas bootstrap JS runs in the browser — no SbtError available
      if (isAtlasBrowserCode(filePath) || isTemplate(filePath)) return [];
      const warnings: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (/\bnew Error\s*\(/.test(lines[i])) {
          warnings.push(`${i + 1}: ${lines[i].trim()}`);
        }
      }
      return warnings;
    },
  },

  // R3: Use `withHelp()` wrapper on plugin commands
  {
    id: "command-withhelp",
    description: "Plugin command `run` should be wrapped with `withHelp()`",
    check(filePath, content, lines) {
      const rel = relPath(filePath);
      // Only check plugin index.ts files (not core's register-core.ts — those
      // delegate to functions that are already withHelp-wrapped at source)
      if (!rel.match(/plugin-[^/]+\/src\/index\.ts$/)) return [];
      if (!content.includes("commands:")) return [];
      const warnings: string[] = [];
      // Look for `run:` that is NOT preceded/wrapped by withHelp
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*run\s*[:]\s*/.test(line) && !line.includes("withHelp")) {
          let found = false;
          for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
            if (lines[j].includes("withHelp")) { found = true; break; }
          }
          if (!found) {
            warnings.push(`${i + 1}: command \`run\` not wrapped with \`withHelp()\``);
          }
        }
      }
      if (!content.includes("withHelp")) {
        warnings.push(`1: file defines commands but does not import \`withHelp\``);
      }
      return warnings;
    },
  },

  // R4: Use buildAtlasUI() for Atlas UI contributions
  {
    id: "atlas-use-builder",
    description: "Atlas UI contributions should use `buildAtlasUI()` from @sbtools/sdk",
    check(filePath, content, _lines) {
      const rel = relPath(filePath);
      if (!rel.match(/plugin-[^/]+\/src\/index\.ts$/)) return [];
      // Skip scaffold — it references getAtlasUI in template strings, not as its own hook
      if (rel.includes("plugin-scaffold")) return [];
      // If plugin has getAtlasUI hook, check that atlas.ts exists with buildAtlasUI
      if (!content.includes("getAtlasUI")) return [];
      const pluginDir = path.dirname(filePath);
      const atlasFile = path.join(pluginDir, "atlas.ts");
      if (!fs.existsSync(atlasFile)) {
        return [`1: plugin has getAtlasUI but no atlas.ts module using buildAtlasUI()`];
      }
      const atlasContent = fs.readFileSync(atlasFile, "utf8");
      if (!atlasContent.includes("buildAtlasUI")) {
        return [`1: atlas.ts does not use buildAtlasUI() from @sbtools/sdk`];
      }
      return [];
    },
  },

  // R5: Parameterized schema filters — no string interpolation in SQL queries
  {
    id: "no-interpolated-schema-filter",
    description: "Schema filters must use parameterized queries (SchemaFilter.clause + .params)",
    check(filePath, _content, lines) {
      const rel = relPath(filePath);
      if (!rel.includes("/extractors/")) return [];
      const warnings: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Flag direct string interpolation of schemaFilter as a string
        if (/\$\{.*schemaFilter[^.]*\}/.test(line) && !line.includes(".clause")) {
          warnings.push(`${i + 1}: schema filter appears to be string-interpolated instead of using .clause/.params`);
        }
      }
      return warnings;
    },
  },

  // R6: process.exit() should only be in cli.ts, errors.ts, and signal handlers
  {
    id: "no-process-exit",
    description: "Avoid `process.exit()` — throw SbtError and let handleError() manage exit",
    check(filePath, _content, lines) {
      if (isSdkErrors(filePath) || isCliEntrypoint(filePath) || isTemplate(filePath)) return [];
      const rel = relPath(filePath);
      const warnings: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/process\.exit\s*\(/.test(line)) {
          // Allow in signal handlers (SIGINT/SIGTERM) and server shutdown
          const context = lines.slice(Math.max(0, i - 5), i + 1).join("\n");
          if (/SIG(INT|TERM)|shutdown|server\.close/.test(context)) continue;
          warnings.push(`${i + 1}: ${line.trim()}`);
        }
      }
      return warnings;
    },
  },

  // R7: Section separator comment banners add noise
  {
    id: "no-separator-comments",
    description: "Avoid `// -----...` separator banners — use whitespace or code structure instead",
    check(_filePath, _content, lines) {
      const warnings: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*\/\/\s*-{10,}/.test(lines[i])) {
          warnings.push(`${i + 1}: ${lines[i].trim()}`);
        }
      }
      return warnings;
    },
  },

  // R8: Redundant @param JSDoc that restates the type signature
  {
    id: "no-redundant-param-jsdoc",
    description: "Avoid @param JSDoc that merely restates the TypeScript type",
    check(_filePath, _content, lines) {
      const warnings: string[] = [];
      const trivialParams = [
        /^\s*\*\s*@param\s+\w+\s*-?\s*(The\s+)?(connected\s+)?postgres\s+client/i,
        /^\s*\*\s*@param\s+\w+\s*-?\s*(The\s+)?snapshot\s+context/i,
        /^\s*\*\s*@param\s+\w+\s*-?\s*(The\s+)?plugin\s+context/i,
        /^\s*\*\s*@param\s+\w+\s*-?\s*(The\s+)?args?\s+(array|string)/i,
      ];
      for (let i = 0; i < lines.length; i++) {
        for (const pat of trivialParams) {
          if (pat.test(lines[i])) {
            warnings.push(`${i + 1}: ${lines[i].trim()}`);
            break;
          }
        }
      }
      return warnings;
    },
  },

  // R9: Old atlas triad pattern — atlas/sections.ts or atlas/cards.ts should not exist
  {
    id: "no-atlas-triad-leftovers",
    description: "Old atlas/sections.ts and atlas/cards.ts should be replaced by atlas.ts + buildAtlasUI()",
    check(filePath, _content, _lines) {
      const rel = relPath(filePath);
      if (/\/atlas\/(sections|cards)\.ts$/.test(rel)) {
        return [`1: legacy atlas triad file — migrate to buildAtlasUI() in atlas.ts`];
      }
      return [];
    },
  },

  // R10: loadPackageVersion — plugins should use it instead of hardcoded version strings
  {
    id: "use-load-package-version",
    description: "Plugin version should use `loadPackageVersion(import.meta.url)` not a hardcoded string",
    check(filePath, content, lines) {
      const rel = relPath(filePath);
      if (!rel.match(/plugin-[^/]+\/src\/index\.ts$/)) return [];
      if (!content.includes("version:")) return [];
      const warnings: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        // Match version: "1.0.0" or version: '1.0.0' (hardcoded)
        if (/^\s*version\s*:\s*["'][0-9]/.test(lines[i])) {
          warnings.push(`${i + 1}: hardcoded version string — use loadPackageVersion(import.meta.url)`);
        }
      }
      return warnings;
    },
  },
];

// ── Runner ───────────────────────────────────────────────────────────────────

function run(): void {
  const files = discoverSourceFiles();
  const warnings: Warning[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");

    for (const rule of rules) {
      const hits = rule.check(file, content, lines);
      for (const hit of hits) {
        const colonIdx = hit.indexOf(":");
        const lineNum = colonIdx > 0 ? parseInt(hit.substring(0, colonIdx), 10) : 0;
        const message = colonIdx > 0 ? hit.substring(colonIdx + 1).trim() : hit;
        warnings.push({ rule: rule.id, file: relPath(file), line: lineNum || 0, message });
      }
    }
  }

  // ── Output ──────────────────────────────────────────────────────────────

  if (warnings.length === 0) {
    console.log("\n  ✅ No convention warnings found.\n");
    return;
  }

  // Group by rule
  const byRule = new Map<string, Warning[]>();
  for (const w of warnings) {
    if (!byRule.has(w.rule)) byRule.set(w.rule, []);
    byRule.get(w.rule)!.push(w);
  }

  const YELLOW = "\x1b[33m";
  const DIM = "\x1b[2m";
  const BOLD = "\x1b[1m";
  const RESET = "\x1b[0m";
  const CYAN = "\x1b[36m";

  console.log(`\n${BOLD}Convention Lint — ${warnings.length} warning(s)${RESET}\n`);

  for (const rule of rules) {
    const hits = byRule.get(rule.id);
    if (!hits || hits.length === 0) continue;

    console.log(`${YELLOW}⚠ ${rule.id}${RESET} ${DIM}(${hits.length})${RESET} — ${rule.description}`);
    for (const w of hits) {
      const loc = w.line > 0 ? `:${w.line}` : "";
      console.log(`  ${CYAN}${w.file}${loc}${RESET} ${DIM}${w.message}${RESET}`);
    }
    console.log();
  }

  console.log(`${DIM}All warnings are advisory — fix at your convenience.${RESET}\n`);
}

run();
