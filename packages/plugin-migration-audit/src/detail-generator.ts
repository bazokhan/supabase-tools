/**
 * Migration detail page generator.
 * One HTML page per migration with SQL viewer, operation summary, and risk panel.
 */
import fs from "node:fs";
import path from "node:path";
import { renderMigrationDetailPage } from "@sbtools/ui-web";
import type { MigrationEntry } from "./types.js";

/** Slug for detail page URL (filename without .sql, sanitized). */
export function migrationDetailSlug(filename: string): string {
  return filename.replace(/\.sql$/i, "").replace(/[^a-z0-9_-]/gi, "_");
}

/**
 * Generate HTML for a single migration detail page.
 */
export function generateMigrationDetailHtml(
  migration: MigrationEntry,
  indexUrl: string
): string {
  let sqlContent = "";
  try {
    if (fs.existsSync(migration.filePath) && migration.status !== "missing") {
      sqlContent = fs.readFileSync(migration.filePath, "utf8");
    }
  } catch {
    sqlContent = "-- (Unable to read file)";
  }

  return renderMigrationDetailPage({
    filename: migration.filename,
    status: migration.status,
    appliedAt: migration.appliedAt?.toISOString() ?? null,
    fileModifiedAt: migration.fileModifiedAt?.toISOString() ?? null,
    sizeBytes: migration.sizeBytes,
    parserConfidence: migration.sqlAnalysis?.confidence,
    operations: migration.sqlAnalysis?.operations ?? [],
    touchedObjectKeys: migration.sqlAnalysis?.touchedObjectKeys ?? [],
    risk: migration.sqlAnalysis?.riskFlags,
    sql: sqlContent,
    indexUrl,
  });
}

/**
 * Write migration detail pages to output directory.
 * Returns the base URL path for detail links (e.g. "migration-audit/").
 * Detail pages: docsOutput/migration-audit/<slug>.html
 * Index: docsOutput/migration-audit.html
 */
export function writeMigrationDetailPages(
  migrations: MigrationEntry[],
  docsDir: string,
  indexFilePath: string
): string {
  const detailDir = path.join(docsDir, "migration-audit");
  if (!fs.existsSync(detailDir)) {
    fs.mkdirSync(detailDir, { recursive: true });
  }

  const indexBasename = path.basename(indexFilePath);
  const indexUrl = `../${indexBasename}`;

  for (const m of migrations) {
    if (m.status === "missing" || !m.filePath) continue;
    const slug = migrationDetailSlug(m.filename);
    const html = generateMigrationDetailHtml(m, indexUrl);
    const outPath = path.join(detailDir, `${slug}.html`);
    fs.writeFileSync(outPath, html, "utf8");
  }

  return "migration-audit/";
}
