import fs from "node:fs";
import path from "node:path";
import { renderMigrationAuditPage } from "@sbtools/ui-web";
import type { AuditResult } from "./types.js";
import { writeMigrationDetailPages } from "./detail-generator.js";

export function generateHtml(result: AuditResult): string {
  return renderMigrationAuditPage({
    summary: result.summary,
    issues: result.issues,
    migrations: result.migrations.map((m) => ({
      filename: m.filename,
      status: m.status,
      appliedAt: m.appliedAt?.toISOString() ?? null,
      sizeBytes: m.sizeBytes,
    })),
    schema: result.schema
      ? {
          dbSize: result.schema.dbSize ?? undefined,
          pgVersion: result.schema.pgVersion ?? undefined,
        }
      : undefined,
  });
}

export function writeHtml(result: AuditResult, outputPath: string): void {
  const html = generateHtml(result);
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, html, "utf8");
  writeMigrationDetailPages(result.migrations, dir, outputPath);
}
