/**
 * Self-contained HTML report for migration audit.
 * Dark theme matching existing plugins.
 */
import fs from "node:fs";
import path from "node:path";
import type { AuditResult } from "./types.js";

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

function formatBytes(n: number): string {
  if (n === 0) return "0 B";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

const STATUS_CLASS: Record<string, string> = {
  applied: "status-applied",
  pending: "status-pending",
  missing: "status-missing",
};

const SEVERITY_CLASS: Record<string, string> = {
  error: "alert-error",
  warning: "alert-warning",
  info: "alert-info",
};

export function generateHtml(result: AuditResult): string {
  const { migrations, issues, summary, schema } = result;
  const dataJson = JSON.stringify({
    migrations: migrations.map((m) => ({
      filename: m.filename,
      status: m.status,
      appliedAt: m.appliedAt?.toISOString() ?? null,
      sizeBytes: m.sizeBytes,
      fileModifiedAt: m.fileModifiedAt?.toISOString() ?? null,
    })),
  });

  const statsHtml = `
    <div class="stat-box"><div class="stat-value">${summary.total}</div><div class="stat-label">Total</div></div>
    <div class="stat-box"><div class="stat-value stat-applied">${summary.applied}</div><div class="stat-label">Applied</div></div>
    <div class="stat-box"><div class="stat-value stat-pending">${summary.pending}</div><div class="stat-label">Pending</div></div>
    <div class="stat-box"><div class="stat-value stat-missing">${summary.missing}</div><div class="stat-label">Missing</div></div>
    <div class="stat-box"><div class="stat-value">${summary.errors + summary.warnings + summary.infos}</div><div class="stat-label">Issues</div></div>
    ${schema?.dbSize ? `<div class="stat-box"><div class="stat-value">${escapeHtml(schema.dbSize)}</div><div class="stat-label">DB Size</div></div>` : ""}
    ${schema?.pgVersion ? `<div class="stat-box stat-pg"><div class="stat-value">${escapeHtml(schema.pgVersion.split(" ").slice(0, 2).join(" "))}</div><div class="stat-label">PG Version</div></div>` : ""}
  `;

  const issuesHtml = issues
    .map(
      (i) => `
    <div class="alert ${SEVERITY_CLASS[i.severity] || ""}">
      <div class="alert-title">${escapeHtml(i.code)}</div>
      <div class="alert-msg">${escapeHtml(i.message)}</div>
      ${i.affectedMigrations?.length ? `<div class="alert-migrations">${i.affectedMigrations.map((f) => `<code>${escapeHtml(f)}</code>`).join(", ")}</div>` : ""}
    </div>`
    )
    .join("\n");

  const tableRows = migrations
    .map(
      (m) => `
    <tr data-filename="${escapeHtml(m.filename)}" data-status="${escapeHtml(m.status)}">
      <td><span class="badge ${STATUS_CLASS[m.status] || ""}">${escapeHtml(m.status)}</span></td>
      <td><code>${escapeHtml(m.filename)}</code></td>
      <td>${escapeHtml(formatDate(m.appliedAt))}</td>
      <td>${escapeHtml(formatBytes(m.sizeBytes))}</td>
    </tr>`
    )
    .join("\n");

  const schemaTables = schema?.publicTableNames?.length
    ? schema.publicTableNames
        .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
        .join(" ")
    : '<span class="text-dim">No public tables</span>';

  const schemaCounts = schema
    ? `
    <div class="schema-grid">
      <div class="schema-item"><span class="schema-val">${schema.publicTableCount}</span><span class="schema-lbl">Tables</span></div>
      <div class="schema-item"><span class="schema-val">${schema.functionCount}</span><span class="schema-lbl">Functions</span></div>
      <div class="schema-item"><span class="schema-val">${schema.triggerCount}</span><span class="schema-lbl">Triggers</span></div>
      <div class="schema-item"><span class="schema-val">${schema.policyCount}</span><span class="schema-lbl">Policies</span></div>
      <div class="schema-item"><span class="schema-val">${schema.viewCount}</span><span class="schema-lbl">Views</span></div>
    </div>
  `
    : "";

  const timelineHtml = migrations
    .map(
      (m) => `
    <div class="timeline-item" data-status="${escapeHtml(m.status)}">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <code>${escapeHtml(m.filename)}</code>
        <span class="timeline-meta">${escapeHtml(formatDate(m.appliedAt))} · ${escapeHtml(m.status)}</span>
      </div>
    </div>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Migration Audit</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
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

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.5;
    padding: 24px;
  }

  h1 { font-size: 1.5rem; margin-bottom: 8px; }
  .subtitle { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 24px; }

  .stats-row { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
  .stat-box {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 20px;
    min-width: 100px;
  }
  .stat-value { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
  .stat-value.stat-applied { color: var(--green); }
  .stat-value.stat-pending { color: var(--amber); }
  .stat-value.stat-missing { color: var(--red); }
  .stat-pg .stat-value { font-size: 0.9rem; }
  .stat-label { font-size: 0.75rem; color: var(--text-dim); }

  .section { margin-bottom: 32px; }
  .section h2 {
    font-size: 1rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 12px;
  }

  .filter-bar {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  #search {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    padding: 8px 12px;
    font-size: 0.9rem;
    width: 280px;
    outline: none;
  }
  #search:focus { border-color: var(--accent); }
  .filter-chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .filter-chip {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-muted);
  }
  .filter-chip:hover { background: #334155; color: var(--text); }
  .filter-chip.active { border-color: var(--accent); color: var(--accent); background: rgba(59,130,246,0.15); }

  .alert {
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 12px;
    border: 1px solid;
  }
  .alert-error { background: rgba(239,68,68,0.15); border-color: var(--red); }
  .alert-warning { background: rgba(245,158,11,0.15); border-color: var(--amber); }
  .alert-info { background: rgba(59,130,246,0.15); border-color: var(--accent); }
  .alert-title { font-weight: 600; font-size: 0.85rem; margin-bottom: 4px; }
  .alert-msg { font-size: 0.9rem; color: var(--text-muted); }
  .alert-migrations { margin-top: 8px; font-size: 0.8rem; }
  .alert-migrations code { background: var(--bg); padding: 2px 6px; border-radius: 4px; margin-right: 4px; }

  table {
    width: 100%;
    border-collapse: collapse;
    background: var(--surface);
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border);
  }
  th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); }
  th {
    background: var(--bg);
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    cursor: pointer;
    user-select: none;
  }
  th:hover { color: var(--text); }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(59, 130, 246, 0.08); }
  tr.hidden { display: none; }
  td code { font-family: ui-monospace, monospace; font-size: 0.85rem; }

  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 500;
  }
  .badge.status-applied { background: rgba(34,197,94,0.2); color: #4ade80; }
  .badge.status-pending { background: rgba(245,158,11,0.2); color: #fbbf24; }
  .badge.status-missing { background: rgba(239,68,68,0.2); color: #f87171; }

  .chip {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.8rem;
    background: var(--surface);
    border: 1px solid var(--border);
    margin: 2px 4px 2px 0;
  }
  .schema-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
    margin-top: 12px;
  }
  .schema-item {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    text-align: center;
  }
  .schema-val { display: block; font-size: 1.25rem; font-weight: 700; color: var(--accent); }
  .schema-lbl { font-size: 0.7rem; color: var(--text-dim); }
  .text-dim { color: var(--text-dim); }

  .timeline {
    border-left: 2px solid var(--border);
    margin-left: 8px;
    padding-left: 20px;
  }
  .timeline-item {
    position: relative;
    padding-bottom: 16px;
  }
  .timeline-item:last-child { padding-bottom: 0; }
  .timeline-dot {
    position: absolute;
    left: -26px;
    top: 4px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .timeline-item[data-status="applied"] .timeline-dot { background: var(--green); }
  .timeline-item[data-status="pending"] .timeline-dot { background: var(--amber); }
  .timeline-item[data-status="missing"] .timeline-dot { background: var(--red); }
  .timeline-content { font-size: 0.9rem; }
  .timeline-content code { font-size: 0.8rem; }
  .timeline-meta { display: block; font-size: 0.75rem; color: var(--text-dim); margin-top: 2px; }
</style>
</head>
<body>

<h1>Migration Audit</h1>
<p class="subtitle">Migration files vs database tracking — ${result.databaseReachable ? "DB connected" : "Disk only (DB unreachable)"} · Audited ${escapeHtml(new Date(result.auditedAt).toLocaleString())}</p>

<div class="stats-row" id="stats">${statsHtml}</div>

${issues.length > 0 ? `
<div class="section">
  <h2>Issues</h2>
  <div id="issues">${issuesHtml}</div>
</div>
` : ""}

<div class="section">
  <h2>Migrations</h2>
  <div class="filter-bar">
    <input type="text" id="search" placeholder="Filter by filename...">
    <div class="filter-chips">
      <span class="filter-chip active" data-status="">All</span>
      <span class="filter-chip" data-status="applied">Applied</span>
      <span class="filter-chip" data-status="pending">Pending</span>
      <span class="filter-chip" data-status="missing">Missing</span>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th data-col="status">Status</th>
        <th data-col="filename">Filename</th>
        <th data-col="appliedAt">Applied At</th>
        <th data-col="size">Size</th>
      </tr>
    </thead>
    <tbody id="tbody">${tableRows}</tbody>
  </table>
</div>

${schema ? `
<div class="section">
  <h2>Schema Overview</h2>
  <div class="schema-grid">${schemaCounts}</div>
  <div style="margin-top:16px">
    <strong>Public tables:</strong>
    <div style="margin-top:8px">${schemaTables}</div>
  </div>
</div>
` : ""}

<div class="section">
  <h2>Timeline</h2>
  <div class="timeline" id="timeline">${timelineHtml}</div>
</div>

<script>
(function() {
  "use strict";
  var data = ${dataJson};
  var statusFilter = "";
  var sortCol = "filename";
  var sortDir = 1;

  function applyFilters() {
    var q = document.getElementById("search").value.toLowerCase().trim();
    var rows = document.querySelectorAll("#tbody tr");
    for (var i = 0; i < rows.length; i++) {
      var filename = (rows[i].getAttribute("data-filename") || "").toLowerCase();
      var status = rows[i].getAttribute("data-status") || "";
      var matchSearch = !q || filename.indexOf(q) !== -1;
      var matchStatus = !statusFilter || status === statusFilter;
      rows[i].classList.toggle("hidden", !(matchSearch && matchStatus));
    }
  }

  document.getElementById("search").addEventListener("input", applyFilters);

  document.querySelectorAll(".filter-chip").forEach(function(chip) {
    chip.addEventListener("click", function() {
      document.querySelectorAll(".filter-chip").forEach(function(c) { c.classList.remove("active"); });
      this.classList.add("active");
      statusFilter = this.getAttribute("data-status") || "";
      applyFilters();
    });
  });

  var colIdx = { status: 0, filename: 1, appliedAt: 2, size: 3 };
  document.querySelectorAll("th[data-col]").forEach(function(th) {
    th.addEventListener("click", function() {
      var col = this.getAttribute("data-col");
      if (sortCol === col) sortDir = -sortDir; else { sortCol = col; sortDir = 1; }
      var rows = Array.from(document.querySelectorAll("#tbody tr")).filter(function(r) { return !r.classList.contains("hidden"); });
      var tbody = document.getElementById("tbody");
      var idx = colIdx[sortCol] || 0;
      rows.sort(function(a, b) {
        var av = (a.cells[idx] && a.cells[idx].textContent) ? a.cells[idx].textContent.trim() : "";
        var bv = (b.cells[idx] && b.cells[idx].textContent) ? b.cells[idx].textContent.trim() : "";
        if (sortCol === "size") {
          var an = parseInt(av.replace(/[^0-9]/g, ""), 10) || 0;
          var bn = parseInt(bv.replace(/[^0-9]/g, ""), 10) || 0;
          return sortDir * (an - bn);
        }
        return sortDir * (av.localeCompare ? av.localeCompare(bv) : (av < bv ? -1 : av > bv ? 1 : 0));
      });
      rows.forEach(function(r) { tbody.appendChild(r); });
    });
  });
})();
</script>
</body>
</html>`;
}

export function writeHtml(result: AuditResult, outputPath: string): void {
  const html = generateHtml(result);
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, html, "utf8");
}
