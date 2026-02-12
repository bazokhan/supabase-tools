/**
 * Single-page HTML builder for the live log viewer.
 *
 * Generates a self-contained HTML string (inline CSS + JS) that connects
 * to the viewer server via SSE and renders logs in real time.
 * Dark theme matching the Backend Atlas design language.
 */
import { SERVICE_HTML_COLORS } from "./formatter.js";
import { SERVICE_NAMES } from "./docker-logs.js";

export function buildViewerHtml(port: number): string {
  const serviceChipsHtml = SERVICE_NAMES.map((s) => {
    const color = SERVICE_HTML_COLORS[s] ?? "#94a3b8";
    return `<button class="chip active" data-service="${s}" style="--chip-color:${color}">${s}</button>`;
  }).join("\n        ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Supabase Log Viewer</title>
<style>
  :root {
    --bg: #0f172a;
    --bg-surface: #1e293b;
    --bg-card: #334155;
    --text: #e2e8f0;
    --text-dim: #94a3b8;
    --border: #475569;
    --accent: #38bdf8;
    --error: #f87171;
    --warn: #fbbf24;
    --info: #4ade80;
    --debug: #64748b;
    --font-mono: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Header */
  header {
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    padding: 12px 20px;
    flex-shrink: 0;
  }
  header h1 {
    font-size: 18px;
    font-weight: 600;
    color: var(--accent);
    margin-bottom: 8px;
  }
  .toolbar {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  /* Tabs */
  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 10px;
  }
  .tab {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 6px 16px;
    border-radius: 6px 6px 0 0;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.15s;
  }
  .tab:hover { color: var(--text); }
  .tab.active {
    background: var(--bg-surface);
    color: var(--accent);
    border-bottom-color: var(--bg-surface);
  }

  /* Chips */
  .chip {
    background: transparent;
    border: 1px solid var(--chip-color, var(--border));
    color: var(--chip-color, var(--text-dim));
    padding: 4px 10px;
    border-radius: 12px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .chip.active {
    background: color-mix(in srgb, var(--chip-color) 20%, transparent);
    font-weight: 600;
  }
  .chip:not(.active) { opacity: 0.4; }

  /* Level chips */
  .level-chips { display: flex; gap: 4px; margin-left: 8px; }
  .level-chip {
    background: transparent;
    border: 1px solid;
    padding: 4px 8px;
    border-radius: 12px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    transition: all 0.15s;
  }
  .level-chip.active { opacity: 1; }
  .level-chip:not(.active) { opacity: 0.3; }
  .level-chip[data-level="error"] { border-color: var(--error); color: var(--error); }
  .level-chip[data-level="warn"] { border-color: var(--warn); color: var(--warn); }
  .level-chip[data-level="info"] { border-color: var(--info); color: var(--info); }
  .level-chip[data-level="debug"] { border-color: var(--debug); color: var(--debug); }

  /* Search */
  .search-box {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 5px 12px;
    border-radius: 6px;
    font-size: 13px;
    width: 200px;
    outline: none;
    transition: border-color 0.15s;
  }
  .search-box:focus { border-color: var(--accent); }

  /* Control buttons */
  .ctrl-btn {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 5px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s;
  }
  .ctrl-btn:hover { color: var(--text); border-color: var(--accent); }
  .ctrl-btn.active { color: var(--accent); border-color: var(--accent); }

  /* Log panel */
  .tab-content { display: none; flex: 1; overflow: hidden; }
  .tab-content.active { display: flex; flex-direction: column; }

  #log-container {
    flex: 1;
    overflow-y: auto;
    padding: 8px 16px;
    font-family: var(--font-mono);
    font-size: 12.5px;
    line-height: 1.7;
  }
  .log-line {
    display: flex;
    gap: 8px;
    padding: 1px 0;
    border-bottom: 1px solid rgba(71,85,105,0.15);
    align-items: baseline;
  }
  .log-line:hover { background: rgba(56,189,248,0.04); }
  .log-ts {
    color: var(--text-dim);
    font-size: 11px;
    flex-shrink: 0;
    width: 70px;
  }
  .log-svc {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    flex-shrink: 0;
    min-width: 80px;
    text-align: center;
    text-transform: uppercase;
  }
  .log-lvl {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    flex-shrink: 0;
    min-width: 32px;
    text-align: center;
  }
  .log-lvl.error { background: rgba(248,113,113,0.2); color: var(--error); }
  .log-lvl.warn { background: rgba(251,191,36,0.2); color: var(--warn); }
  .log-lvl.info { background: rgba(74,222,128,0.15); color: var(--info); }
  .log-lvl.debug { background: rgba(100,116,139,0.2); color: var(--debug); }
  .log-lvl.notice { background: rgba(56,189,248,0.15); color: var(--accent); }
  .log-msg {
    color: var(--text);
    white-space: pre-wrap;
    word-break: break-all;
    flex: 1;
    min-width: 0;
  }

  /* Status indicator */
  .status-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 4px;
  }
  .status-dot.connected { background: var(--info); }
  .status-dot.disconnected { background: var(--error); }

  /* pg-stats panel */
  #pgstats-panel { padding: 20px; overflow-y: auto; }
  .stats-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .stats-table th {
    text-align: left;
    padding: 8px 12px;
    border-bottom: 2px solid var(--border);
    color: var(--accent);
    font-weight: 600;
    position: sticky;
    top: 0;
    background: var(--bg-surface);
  }
  .stats-table td {
    padding: 6px 12px;
    border-bottom: 1px solid rgba(71,85,105,0.3);
    color: var(--text);
  }
  .stats-table tr:hover td { background: rgba(56,189,248,0.04); }
  .stats-table td.query-cell {
    max-width: 500px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .stats-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .stats-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .stats-header h2 { font-size: 16px; color: var(--text); }
  .stats-sort-btns { display: flex; gap: 4px; }

  /* Services panel */
  #services-panel { padding: 20px; overflow-y: auto; }
  .svc-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }
  .svc-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
  }
  .svc-card h3 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 6px;
    text-transform: capitalize;
  }
  .svc-card .svc-status {
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .svc-card .svc-container {
    font-size: 11px;
    color: var(--text-dim);
    margin-top: 4px;
    font-family: var(--font-mono);
  }
  .badge-running {
    background: rgba(74,222,128,0.15);
    color: var(--info);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
  }
  .badge-stopped {
    background: rgba(248,113,113,0.15);
    color: var(--error);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
  }

  /* Connection status bar */
  .status-bar {
    background: var(--bg-surface);
    border-top: 1px solid var(--border);
    padding: 4px 20px;
    font-size: 11px;
    color: var(--text-dim);
    display: flex;
    justify-content: space-between;
    flex-shrink: 0;
  }
</style>
</head>
<body>

<header>
  <div class="tabs">
    <button class="tab active" data-tab="logs">Live Logs</button>
    <button class="tab" data-tab="pgstats">Query Performance</button>
    <button class="tab" data-tab="services">Service Health</button>
  </div>
  <h1>Supabase Log Viewer</h1>
  <div class="toolbar" id="logs-toolbar">
    <div style="display:flex;gap:4px;flex-wrap:wrap;">
      ${serviceChipsHtml}
    </div>
    <div class="level-chips">
      <button class="level-chip active" data-level="error">ERR</button>
      <button class="level-chip active" data-level="warn">WRN</button>
      <button class="level-chip active" data-level="info">INF</button>
      <button class="level-chip active" data-level="debug">DBG</button>
    </div>
    <input class="search-box" id="search" type="text" placeholder="Search logs...">
    <button class="ctrl-btn active" id="auto-scroll-btn">Auto-scroll</button>
    <button class="ctrl-btn" id="clear-btn">Clear</button>
  </div>
</header>

<div class="tab-content active" id="logs-tab">
  <div id="log-container"></div>
</div>

<div class="tab-content" id="pgstats-tab">
  <div id="pgstats-panel">
    <div class="stats-header">
      <h2>pg_stat_statements</h2>
      <div style="display:flex;gap:8px;align-items:center;">
        <div class="stats-sort-btns">
          <button class="ctrl-btn active" data-sort="total">Total Time</button>
          <button class="ctrl-btn" data-sort="slow">Mean Time</button>
          <button class="ctrl-btn" data-sort="frequent">Frequency</button>
        </div>
        <button class="ctrl-btn" id="refresh-stats">Refresh</button>
        <button class="ctrl-btn" id="reset-stats" style="color:var(--error);border-color:var(--error)">Reset</button>
      </div>
    </div>
    <div id="stats-table-wrap">
      <p style="color:var(--text-dim)">Loading...</p>
    </div>
  </div>
</div>

<div class="tab-content" id="services-tab">
  <div id="services-panel">
    <h2 style="font-size:16px;margin-bottom:16px;">Service Health</h2>
    <div class="svc-grid" id="svc-grid">
      <p style="color:var(--text-dim)">Loading...</p>
    </div>
  </div>
</div>

<div class="status-bar">
  <span id="conn-status"><span class="status-dot disconnected"></span> Connecting...</span>
  <span id="log-count">0 lines</span>
</div>

<script>
(function() {
  const BASE = "http://localhost:${port}";
  const logContainer = document.getElementById("log-container");
  const connStatus = document.getElementById("conn-status");
  const logCountEl = document.getElementById("log-count");
  const searchInput = document.getElementById("search");

  // State
  const state = {
    activeServices: new Set(${JSON.stringify(SERVICE_NAMES)}),
    activeLevels: new Set(["error", "warn", "info", "debug", "notice", "unknown"]),
    autoScroll: true,
    searchTerm: "",
    logCount: 0,
    statsSort: "total",
    allLogs: [],
    maxLogs: 5000,
  };

  // ---- Tab switching ----
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      document.getElementById(target + "-tab").classList.add("active");
      if (target === "pgstats") loadStats();
      if (target === "services") loadServices();
    });
  });

  // ---- Service chips ----
  document.querySelectorAll(".chip[data-service]").forEach(chip => {
    chip.addEventListener("click", () => {
      const svc = chip.dataset.service;
      chip.classList.toggle("active");
      if (chip.classList.contains("active")) {
        state.activeServices.add(svc);
      } else {
        state.activeServices.delete(svc);
      }
      refilter();
      reconnectSSE();
    });
  });

  // ---- Level chips ----
  document.querySelectorAll(".level-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      chip.classList.toggle("active");
      const lvl = chip.dataset.level;
      if (chip.classList.contains("active")) {
        state.activeLevels.add(lvl);
      } else {
        state.activeLevels.delete(lvl);
      }
      refilter();
    });
  });

  // ---- Search ----
  searchInput.addEventListener("input", () => {
    state.searchTerm = searchInput.value.toLowerCase();
    refilter();
  });

  // ---- Auto-scroll ----
  const autoScrollBtn = document.getElementById("auto-scroll-btn");
  autoScrollBtn.addEventListener("click", () => {
    state.autoScroll = !state.autoScroll;
    autoScrollBtn.classList.toggle("active", state.autoScroll);
    if (state.autoScroll) scrollToBottom();
  });
  logContainer.addEventListener("scroll", () => {
    const atBottom = logContainer.scrollHeight - logContainer.scrollTop - logContainer.clientHeight < 50;
    if (!atBottom && state.autoScroll) {
      state.autoScroll = false;
      autoScrollBtn.classList.remove("active");
    }
  });

  // ---- Clear ----
  document.getElementById("clear-btn").addEventListener("click", () => {
    logContainer.innerHTML = "";
    state.allLogs = [];
    state.logCount = 0;
    logCountEl.textContent = "0 lines";
  });

  // ---- SSE Connection ----
  let evtSource = null;

  function connectSSE() {
    const services = [...state.activeServices].join(",") || "none";
    const url = BASE + "/stream?services=" + services;
    if (evtSource) evtSource.close();
    evtSource = new EventSource(url);

    evtSource.onopen = () => {
      connStatus.innerHTML = '<span class="status-dot connected"></span> Connected';
    };
    evtSource.onerror = () => {
      connStatus.innerHTML = '<span class="status-dot disconnected"></span> Disconnected';
    };
    evtSource.onmessage = (e) => {
      try {
        const log = JSON.parse(e.data);
        addLogLine(log);
      } catch { /* skip malformed */ }
    };
  }

  let reconnectTimer = null;
  function reconnectSSE() {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectSSE, 150);
  }

  const SERVICE_COLORS = ${JSON.stringify(SERVICE_HTML_COLORS)};

  function addLogLine(log) {
    state.allLogs.push(log);
    if (state.allLogs.length > state.maxLogs) {
      state.allLogs.shift();
      if (logContainer.firstChild) logContainer.removeChild(logContainer.firstChild);
    }
    state.logCount++;
    logCountEl.textContent = state.logCount + " lines";

    const el = createLogEl(log);
    if (!shouldShow(log)) el.style.display = "none";
    logContainer.appendChild(el);
    if (state.autoScroll) scrollToBottom();
  }

  function createLogEl(log) {
    const div = document.createElement("div");
    div.className = "log-line";
    div.dataset.service = log.service;
    div.dataset.level = log.level;

    const ts = document.createElement("span");
    ts.className = "log-ts";
    ts.textContent = log.timestamp || "";

    const svc = document.createElement("span");
    svc.className = "log-svc";
    const svcColor = SERVICE_COLORS[log.service] || "#94a3b8";
    svc.style.background = svcColor + "22";
    svc.style.color = svcColor;
    svc.textContent = log.service;

    const lvl = document.createElement("span");
    lvl.className = "log-lvl " + log.level;
    const lvlMap = {error:"ERR",warn:"WRN",info:"INF",debug:"DBG",notice:"NTC",unknown:"---"};
    lvl.textContent = lvlMap[log.level] || "---";

    const msg = document.createElement("span");
    msg.className = "log-msg";
    msg.textContent = log.message;

    div.append(ts, svc, lvl, msg);
    return div;
  }

  function shouldShow(log) {
    if (!state.activeServices.has(log.service)) return false;
    if (!state.activeLevels.has(log.level)) return false;
    if (state.searchTerm && !log.message.toLowerCase().includes(state.searchTerm)) return false;
    return true;
  }

  function refilter() {
    logContainer.querySelectorAll(".log-line").forEach(el => {
      const log = { service: el.dataset.service, level: el.dataset.level, message: el.querySelector(".log-msg").textContent };
      el.style.display = shouldShow(log) ? "" : "none";
    });
  }

  function scrollToBottom() {
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  // ---- pg_stat_statements ----
  async function loadStats() {
    const wrap = document.getElementById("stats-table-wrap");
    wrap.innerHTML = '<p style="color:var(--text-dim)">Loading...</p>';
    try {
      const res = await fetch(BASE + "/pg-stats?sort=" + state.statsSort);
      const data = await res.json();
      if (!data.available) {
        wrap.innerHTML = '<p style="color:var(--error)">pg_stat_statements not available: ' + (data.error || "unknown") + '</p>';
        return;
      }
      if (data.queries.length === 0) {
        wrap.innerHTML = '<p style="color:var(--text-dim)">No queries tracked yet (' + data.total_tracked + ' total).</p>';
        return;
      }
      let html = '<table class="stats-table"><thead><tr>';
      html += '<th>Query</th><th>Calls</th><th>Total (ms)</th><th>Mean (ms)</th><th>Rows</th><th>Hit %</th>';
      html += '</tr></thead><tbody>';
      for (const q of data.queries) {
        html += '<tr>';
        html += '<td class="query-cell" title="' + escHtml(q.query) + '">' + escHtml(q.query) + '</td>';
        html += '<td class="num">' + q.calls.toLocaleString() + '</td>';
        html += '<td class="num">' + q.total_exec_time_ms.toFixed(2) + '</td>';
        html += '<td class="num">' + q.mean_exec_time_ms.toFixed(2) + '</td>';
        html += '<td class="num">' + q.rows.toLocaleString() + '</td>';
        html += '<td class="num">' + q.hit_rate + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table>';
      wrap.innerHTML = html;
    } catch (err) {
      wrap.innerHTML = '<p style="color:var(--error)">Failed to load: ' + err.message + '</p>';
    }
  }

  document.querySelectorAll("[data-sort]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-sort]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.statsSort = btn.dataset.sort;
      loadStats();
    });
  });
  document.getElementById("refresh-stats").addEventListener("click", loadStats);
  document.getElementById("reset-stats").addEventListener("click", async () => {
    if (!confirm("Reset all pg_stat_statements data?")) return;
    await fetch(BASE + "/pg-stats-reset", { method: "POST" });
    loadStats();
  });

  // ---- Service Health ----
  async function loadServices() {
    const grid = document.getElementById("svc-grid");
    grid.innerHTML = '<p style="color:var(--text-dim)">Loading...</p>';
    try {
      const res = await fetch(BASE + "/services");
      const data = await res.json();
      let html = "";
      for (const s of data) {
        const badgeClass = s.running ? "badge-running" : "badge-stopped";
        const badgeText = s.running ? "running" : s.status;
        const svcColor = SERVICE_COLORS[s.service] || "#94a3b8";
        html += '<div class="svc-card">';
        html += '<h3 style="color:' + svcColor + '">' + s.service + '</h3>';
        html += '<div class="svc-status"><span class="' + badgeClass + '">' + badgeText + '</span></div>';
        html += '<div class="svc-container">' + s.container + '</div>';
        html += '</div>';
      }
      grid.innerHTML = html;
    } catch (err) {
      grid.innerHTML = '<p style="color:var(--error)">Failed to load: ' + err.message + '</p>';
    }
  }

  function escHtml(s) {
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // ---- Init ----
  connectSSE();
  loadServices();
})();
</script>
</body>
</html>`;
}
