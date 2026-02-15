/**
 * @sbtools/plugin-migration-audit
 *
 * Read-only migration analysis plugin. Compares migration files on disk with
 * app_migrations.schema_migrations, detects drift, and reports via CLI, JSON,
 * HTML report, and Atlas integration. Makes zero schema modifications.
 *
 * Activated by adding an entry in supabase-tools.config.json:
 *
 *   "plugins": [{
 *     "path": "node_modules/@sbtools/plugin-migration-audit",
 *     "config": {}
 *   }]
 */
import path from "node:path";
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";
import { hasFlag, openFile, ui } from "@sbtools/sdk";
import { scanMigrationFiles } from "./migration-scanner.js";
import {
  createClient,
  testConnection,
  checkTrackingTable,
  getAppliedMigrations,
  getSchemaSnapshot,
  disconnectClient,
} from "./db-client.js";
import { buildAuditResult } from "./auditor.js";
import { generateHtml, writeHtml } from "./html-generator.js";
import { writeMigrationAnalysisArtifact } from "./artifact.js";
import { migrationAuditSectionHtml } from "./atlas/sections.js";
import { migrationAuditCardRendererJs } from "./atlas/cards.js";
import { migrationAuditStyles } from "./atlas/styles.js";
import type { AuditResult, SchemaSnapshot } from "./types.js";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function resolvePaths(ctx: PluginContext) {
  const docsDir = ctx.paths.docsOutput;
  const migrationsDir = ctx.paths.migrations;
  const htmlOutput = path.join(docsDir, "migration-audit.html");
  return { docsDir, migrationsDir, htmlOutput };
}

// ---------------------------------------------------------------------------
// runAudit
// ---------------------------------------------------------------------------

export async function runAudit(ctx: PluginContext): Promise<AuditResult> {
  const { migrationsDir } = resolvePaths(ctx);

  const files = scanMigrationFiles(migrationsDir);

  let trackingTableExists = false;
  let databaseReachable = false;
  let applied: { version: string; appliedAt: Date }[] = [];
  let schema: SchemaSnapshot | null = null;

  const client = createClient();

  try {
    databaseReachable = await testConnection(client);
    if (databaseReachable) {
      trackingTableExists = await checkTrackingTable(client);
      if (trackingTableExists) {
        applied = await getAppliedMigrations(client);
      }
      schema = await getSchemaSnapshot(client);
    }
  } finally {
    await disconnectClient(client);
  }

  return buildAuditResult({
    migrationsDir,
    files,
    applied,
    trackingTableExists,
    databaseReachable,
    schema,
  });
}

// ---------------------------------------------------------------------------
// CLI: migration-audit command
// ---------------------------------------------------------------------------

async function migrationAuditCommand(args: string[], ctx: PluginContext): Promise<void> {
  if (hasFlag(args, "--help", "-h")) {
    console.log(`
migration-audit — Compare migration files with database tracking

Usage:
  sbt migration-audit              CLI summary + HTML report + open browser
  sbt migration-audit --json       Output raw JSON to stdout
  sbt migration-audit --html       Generate HTML report only
  sbt migration-audit --no-open    Skip opening the report in browser

Options:
  --json       Output raw audit JSON to stdout
  --html       Generate only the HTML report (no CLI summary)
  --no-open    Do not open the HTML report in browser
  -h, --help   Show this help

Read-only: no schema modifications. Uses DATABASE_URL, SUPABASE_DB_URL, or
POSTGRES_URL (default: postgresql://postgres:postgres@localhost:54322/postgres).
`);
    return;
  }

  const paths = resolvePaths(ctx);
  const onlyJson = hasFlag(args, "--json");
  const onlyHtml = hasFlag(args, "--html");
  const shouldOpen = !hasFlag(args, "--no-open");

  const result = await runAudit(ctx);
  writeMigrationAnalysisArtifact(ctx, result);

  if (onlyJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (onlyHtml) {
    writeHtml(result, paths.htmlOutput);
    console.log(`HTML report written to ${paths.htmlOutput}`);
    if (shouldOpen) openFile(paths.htmlOutput);
    return;
  }

  // Default: CLI summary + HTML + open
  const { summary } = result;
  ui.step("Migration Audit\n");
  ui.detail(`  Total: ${summary.total} | Applied: ${summary.applied} | Pending: ${summary.pending} | Missing: ${summary.missing}`);
  ui.detail(`  Issues: ${summary.errors} error(s), ${summary.warnings} warning(s), ${summary.infos} info`);
  if (result.schema?.dbSize) {
    ui.detail(`  DB Size: ${result.schema.dbSize}`);
  }
  if (!result.databaseReachable) {
    ui.warn("  Database unreachable — disk-only analysis");
  }

  writeHtml(result, paths.htmlOutput);
  ui.success(`\nReport: ${paths.htmlOutput}`);
  if (shouldOpen) openFile(paths.htmlOutput);
}

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-migration-audit",
  version: "0.4.0",
  artifactCapabilities: {
    produces: ["migration.analysis"],
    consumes: ["snapshot.object-index"],
  },

  commands: [
    {
      name: "migration-audit",
      description: "Audit migration files vs database tracking (read-only)",
      run: migrationAuditCommand,
    },
  ],

  getAtlasData: async (ctx: PluginContext) => {
    const result = await runAudit(ctx);
    writeMigrationAnalysisArtifact(ctx, result);

    const cards = result.migrations.map((m) => ({
      filename: m.filename,
      status: m.status,
      applied_at: m.appliedAt?.toISOString() ?? null,
      size_bytes: m.sizeBytes,
    }));

    const summary = {
      total: result.summary.total,
      applied: result.summary.applied,
      pending: result.summary.pending,
      missing: result.summary.missing,
      issues: result.summary.errors + result.summary.warnings + result.summary.infos,
      db_size: result.schema?.dbSize ?? null,
    };

    return {
      categories: {
        migration_audit: [summary, ...cards],
      },
      stats: [
        { label: "Migrations Total", value: result.summary.total },
        { label: "Migrations Applied", value: result.summary.applied },
        { label: "Migrations Pending", value: result.summary.pending },
        { label: "Migrations Missing", value: result.summary.missing },
      ],
    };
  },

  getAtlasUI: () => ({
    kindLabels: {
      migration_audit: "Migration Audit",
    },
    sectionHtml: migrationAuditSectionHtml(),
    cardRendererJs: migrationAuditCardRendererJs(),
    initJs: [
      "renderMigrationAuditSummary(data);",
      'var ma = data.categories.migration_audit;',
      'var maCards = ma && ma.length > 1 ? ma.slice(1) : [];',
      'renderSection("migration-audit-list", maCards, renderMigrationAuditCard, "migrations");',
    ].join("\n    "),
    styles: migrationAuditStyles(),
  }),

  getStatusLines: async (ctx: PluginContext) => {
    const result = await runAudit(ctx);
    writeMigrationAnalysisArtifact(ctx, result);
    const lines: string[] = [];
    lines.push(
      `  Migration Audit: ${result.summary.total} total, ${result.summary.applied} applied, ${result.summary.pending} pending, ${result.summary.missing} missing`
    );
    if (result.summary.errors + result.summary.warnings > 0) {
      lines.push(`    Issues: ${result.summary.errors} error(s), ${result.summary.warnings} warning(s)`);
    }
    return lines;
  },
};

export default plugin;
