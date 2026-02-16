/**
 * Migration detail page generator.
 * One HTML page per migration with SQL viewer, operation summary, and risk panel.
 */
import fs from "node:fs";
import path from "node:path";
import type { MigrationEntry } from "./types.js";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toISOString().replace("T", " ").slice(0, 19);
}

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
  const slug = migrationDetailSlug(migration.filename);
  let sqlContent = "";
  try {
    if (fs.existsSync(migration.filePath) && migration.status !== "missing") {
      sqlContent = fs.readFileSync(migration.filePath, "utf8");
    }
  } catch {
    sqlContent = "-- (Unable to read file)";
  }

  const analysis = migration.sqlAnalysis;
  const ops = analysis?.operations ?? [];
  const risk = analysis?.riskFlags;

  const statusClass = `status-${migration.status}`;
  const opsChips = ops
    .map(
      (op) =>
        `<span class="op-chip op-${op.kind}" title="${escapeHtml(op.objectKey)}">${escapeHtml(op.kind.replace(/_/g, " "))}</span>`
    )
    .join(" ");

  const riskPanel =
    risk && (risk.hasDestructive || risk.hasTruncate || risk.hasTransaction)
      ? `
    <div class="risk-panel">
      <h3>Risk indicators</h3>
      <ul>
        ${risk.hasDestructive ? '<li><span class="risk-badge destructive">Destructive</span> DROP/ALTER may remove or change objects</li>' : ""}
        ${risk.hasTruncate ? '<li><span class="risk-badge truncate">TRUNCATE</span> Data loss possible</li>' : ""}
        ${risk.hasTransaction ? '<li><span class="risk-badge tx">Transaction</span> Explicit BEGIN/COMMIT</li>' : ""}
        ${risk.hasIfExists ? '<li><span class="risk-badge safe">IF EXISTS</span> Idempotent guard</li>' : ""}
        ${risk.hasIfNotExists ? '<li><span class="risk-badge safe">IF NOT EXISTS</span> Idempotent guard</li>' : ""}
      </ul>
    </div>`
      : risk?.hasIfExists || risk?.hasIfNotExists
        ? `
    <div class="risk-panel risk-low">
      <h3>Risk indicators</h3>
      <ul>
        ${risk.hasIfExists ? '<li><span class="risk-badge safe">IF EXISTS</span></li>' : ""}
        ${risk.hasIfNotExists ? '<li><span class="risk-badge safe">IF NOT EXISTS</span></li>' : ""}
      </ul>
    </div>`
        : "";

  const touchedList =
    analysis?.touchedObjectKeys?.length &&
    analysis.touchedObjectKeys.length > 0 &&
    analysis.touchedObjectKeys.length <= 50
      ? `
    <div class="touched-section">
      <h3>Touched objects (${analysis.touchedObjectKeys.length})</h3>
      <div class="touched-list">
        ${analysis.touchedObjectKeys.map((k) => `<code class="touched-key">${escapeHtml(k)}</code>`).join(" ")}
      </div>
    </div>`
      : analysis?.touchedObjectKeys?.length
        ? `
    <div class="touched-section">
      <h3>Touched objects (${analysis.touchedObjectKeys.length})</h3>
      <p class="text-dim">First 20:</p>
      <div class="touched-list">
        ${analysis.touchedObjectKeys.slice(0, 20).map((k) => `<code class="touched-key">${escapeHtml(k)}</code>`).join(" ")}
      </div>
    </div>`
        : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Migration: ${escapeHtml(migration.filename)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f172a;
    --surface: #1e293b;
    --border: #334155;
    --text: #e2e8f0;
    --text-muted: #94a3b8;
    --text-dim: #64748b;
    --accent: #3b82f6;
    --green: #22c55e;
    --amber: #f59e0b;
    --red: #ef4444;
  }
  body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; padding: 24px; }
  h1 { font-size: 1.25rem; margin-bottom: 8px; }
  h2 { font-size: 1rem; color: var(--text-muted); margin: 24px 0 12px; }
  h3 { font-size: 0.9rem; color: var(--text-muted); margin: 16px 0 8px; }
  .subtitle { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .back-link { display: inline-block; margin-bottom: 16px; font-size: 0.9rem; }
  .meta-row { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
  .meta-item { font-size: 0.85rem; }
  .meta-item strong { color: var(--text-muted); font-weight: 500; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 500; }
  .status-applied { background: rgba(34,197,94,0.2); color: #4ade80; }
  .status-pending { background: rgba(245,158,11,0.2); color: #fbbf24; }
  .status-missing { background: rgba(239,68,68,0.2); color: #f87171; }
  .op-chip { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; margin: 2px 4px 2px 0; background: var(--surface); border: 1px solid var(--border); }
  .op-create_table, .op-create_function { border-color: var(--green); }
  .op-drop_table, .op-drop_function { border-color: var(--red); }
  .risk-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 20px; }
  .risk-panel h3 { margin-top: 0; }
  .risk-badge { font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; margin-right: 6px; }
  .risk-badge.destructive { background: rgba(239,68,68,0.2); color: #f87171; }
  .risk-badge.truncate { background: rgba(239,68,68,0.2); color: #f87171; }
  .risk-badge.tx { background: rgba(245,158,11,0.2); color: #fbbf24; }
  .risk-badge.safe { background: rgba(34,197,94,0.2); color: #4ade80; }
  .risk-low { border-color: rgba(34,197,94,0.3); }
  .sql-block { background: #0d1117; border: 1px solid var(--border); border-radius: 8px; padding: 16px; overflow-x: auto; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; line-height: 1.6; }
  .sql-block pre { margin: 0; white-space: pre-wrap; word-break: break-all; }
  .touched-section { margin-bottom: 20px; }
  .touched-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
  .touched-key { font-size: 0.75rem; padding: 4px 8px; background: var(--surface); border-radius: 4px; }
  .text-dim { color: var(--text-dim); font-size: 0.85rem; }
  .confidence { font-size: 0.75rem; color: var(--text-dim); }
</style>
</head>
<body>
<a class="back-link" href="${escapeHtml(indexUrl)}">&larr; Back to Migration Audit</a>

<h1>${escapeHtml(migration.filename)}</h1>
<p class="subtitle">Migration detail &middot; Status: <span class="badge ${statusClass}">${escapeHtml(migration.status)}</span> ${analysis ? `&middot; Parser confidence: ${analysis.confidence}` : ""}</p>

<div class="meta-row">
  <span class="meta-item"><strong>Applied:</strong> ${formatDate(migration.appliedAt)}</span>
  <span class="meta-item"><strong>Size:</strong> ${migration.sizeBytes} B</span>
  <span class="meta-item"><strong>Modified:</strong> ${formatDate(migration.fileModifiedAt)}</span>
</div>

${ops.length > 0 ? `<div class="ops-section"><h3>Operations (${ops.length})</h3><div class="op-chips">${opsChips}</div></div>` : ""}

${riskPanel}
${touchedList}

<h2>SQL</h2>
<div class="sql-block"><pre>${escapeHtml(sqlContent || "-- (Empty or unreadable)")}</pre></div>
</body>
</html>`;
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
