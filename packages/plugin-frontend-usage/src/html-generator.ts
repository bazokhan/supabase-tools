/**
 * Self-contained HTML report for frontend Supabase usage.
 * Dark theme matching depgraph plugin.
 */
import type { FrontendUsageData } from "./patterns.js";
import type { ScanResult } from "./scanner.js";

const TYPE_LABELS: Record<string, string> = {
  table: "Tables",
  rpc: "RPCs",
  auth: "Auth",
  storage: "Storage",
  edge_function: "Edge Functions",
  rest_api: "REST API",
};

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  table: { bg: "#dbeafe", border: "#2563eb", text: "#1e3a5f" },
  rpc: { bg: "#dcfce7", border: "#16a34a", text: "#14532d" },
  auth: { bg: "#ffedd5", border: "#ea580c", text: "#7c2d12" },
  storage: { bg: "#f3e8ff", border: "#9333ea", text: "#581c87" },
  edge_function: { bg: "#ccfbf1", border: "#0d9488", text: "#134e4a" },
  rest_api: { bg: "#fef3c7", border: "#d97706", text: "#78350f" },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateHtml(
  data: FrontendUsageData,
  scanResults: ScanResult[],
): string {
  const dataJson = JSON.stringify({
    data,
    scanResults: scanResults.map((r) => ({
      file: r.file,
      component: r.component,
      hitCount: r.hits.length,
    })),
  });

  const componentRows = Object.entries(data.components)
    .map(([comp, hits]) => {
      const seen = new Set<string>();
      const badges: string[] = [];
      for (const h of hits) {
        const key = `${h.type}:${h.resource}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (badges.length >= 12) continue;
        const c = TYPE_COLORS[h.type] || { bg: "#ccc", border: "#999", text: "#333" };
        badges.push(`<span class="badge" style="background:${c.bg};color:${c.text};border:1px solid ${c.border}" title="${escapeHtml(h.type)}">${escapeHtml(h.resource)}</span>`);
      }
      const more = seen.size > 12 ? `<span class="more">+${seen.size - 12}</span>` : "";
      return `<tr data-component="${escapeHtml(comp)}">
        <td><code>${escapeHtml(comp)}</code></td>
        <td>${badges.join(" ")}${more}</td>
        <td>${hits.length}</td>
      </tr>`;
    })
    .join("\n");

  const resourceSections = data.stats
    .map((s) => {
      const items = data.byResource[s.type as keyof typeof data.byResource] || [];
      const c = TYPE_COLORS[s.type] || { bg: "#ccc", border: "#999" };
      const list = items
        .map((r) => `<span class="resource-chip" style="background:${c.bg};color:${c.text}">${escapeHtml(r)}</span>`)
        .join(" ");
      return `<div class="resource-section">
        <h3>${TYPE_LABELS[s.type] || s.type} (${s.count})</h3>
        <div class="resource-list">${list}</div>
      </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Frontend Supabase Usage</title>
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
    --highlight: #f59e0b;
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

  .stats-row {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 24px;
  }
  .stat-box {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 20px;
    min-width: 120px;
  }
  .stat-value { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
  .stat-label { font-size: 0.75rem; color: var(--text-dim); }

  #search {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    padding: 8px 12px;
    font-size: 0.9rem;
    width: 280px;
    margin-bottom: 16px;
    outline: none;
  }
  #search:focus { border-color: var(--accent); }

  .section {
    margin-bottom: 32px;
  }
  .section h2 {
    font-size: 1rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 12px;
  }
  .section h3 {
    font-size: 0.9rem;
    margin-bottom: 8px;
    color: var(--text);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: var(--surface);
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border);
  }
  th, td {
    padding: 10px 14px;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }
  th {
    background: var(--bg);
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(59, 130, 246, 0.08); }
  tr.hidden { display: none; }

  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 500;
    margin-right: 4px;
    margin-bottom: 4px;
  }
  .more { color: var(--text-dim); font-size: 0.8rem; }

  .resource-section { margin-bottom: 20px; }
  .resource-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .resource-chip {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
  }
</style>
</head>
<body>

<h1>Frontend Supabase Usage</h1>
<p class="subtitle">Components and their Supabase SDK usage (tables, RPCs, auth, storage, edge functions)</p>

<div class="stats-row" id="stats"></div>

<input type="text" id="search" placeholder="Filter by component path...">

<div class="section">
  <h2>Components</h2>
  <table>
    <thead>
      <tr><th>Component</th><th>Resources Used</th><th>Count</th></tr>
    </thead>
    <tbody id="tbody">
      ${componentRows}
    </tbody>
  </table>
</div>

<div class="section">
  <h2>Resources by Type</h2>
  <div id="resources">
    ${resourceSections}
  </div>
</div>

<script>
(function() {
  "use strict";
  var payload = ${dataJson};
  var data = payload.data;
  var components = Object.keys(data.components);

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function updateStats() {
    var totalComponents = components.length;
    var totalHits = 0;
    for (var c in data.components) totalHits += data.components[c].length;
    var tableCount = (data.byResource.table || []).length;
    var rpcCount = (data.byResource.rpc || []).length;
    var authCount = (data.byResource.auth || []).length;
    var storageCount = (data.byResource.storage || []).length;
    var fnCount = (data.byResource.edge_function || []).length;

    document.getElementById("stats").innerHTML =
      '<div class="stat-box"><div class="stat-value">' + totalComponents + '</div><div class="stat-label">Components</div></div>' +
      '<div class="stat-box"><div class="stat-value">' + totalHits + '</div><div class="stat-label">Usage Hits</div></div>' +
      '<div class="stat-box"><div class="stat-value">' + tableCount + '</div><div class="stat-label">Tables</div></div>' +
      '<div class="stat-box"><div class="stat-value">' + rpcCount + '</div><div class="stat-label">RPCs</div></div>' +
      '<div class="stat-box"><div class="stat-value">' + authCount + '</div><div class="stat-label">Auth</div></div>' +
      '<div class="stat-box"><div class="stat-value">' + storageCount + '</div><div class="stat-label">Storage</div></div>' +
      '<div class="stat-box"><div class="stat-value">' + fnCount + '</div><div class="stat-label">Edge Fns</div></div>';
  }

  document.getElementById("search").addEventListener("input", function() {
    var q = this.value.toLowerCase().trim();
    var rows = document.querySelectorAll("#tbody tr");
    for (var i = 0; i < rows.length; i++) {
      var comp = rows[i].getAttribute("data-component") || "";
      rows[i].classList.toggle("hidden", q && comp.toLowerCase().indexOf(q) === -1);
    }
  });

  updateStats();
})();
</script>
</body>
</html>`;
}
