import React from "react";
import { renderPageFrame, scriptJsonVar } from "../components/document.js";

export function renderLogsViewerPage(input: {
  port: number;
  services: string[];
  serviceColors: Record<string, string>;
}): string {
  const serviceButtons = input.services.map((s) => (
    <button key={s} className="badge svc active" data-service={s} style={{ borderColor: input.serviceColors[s] ?? "#cbd5e1" }}>
      {s}
    </button>
  ));

  const script = [
    scriptJsonVar("__SBT_LOGS_CONFIG", input),
    `
(function(){
  const cfg = window.__SBT_LOGS_CONFIG;
  const selected = new Set(cfg.services);
  const logWrap = document.getElementById("logs");
  const search = document.getElementById("search");
  const conn = document.getElementById("conn");
  const tabs = document.querySelectorAll("[data-tab]");
  const panes = document.querySelectorAll("[data-pane]");
  const pgTable = document.getElementById("pg-table");
  const svcTable = document.getElementById("svc-table");
  let source = null;
  function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");}
  function activate(name){
    tabs.forEach(t => t.classList.toggle("active", t.getAttribute("data-tab") === name));
    panes.forEach(p => p.classList.toggle("hidden", p.getAttribute("data-pane") !== name));
    if (name === "pg") fetchPg();
    if (name === "svc") fetchSvc();
  }
  tabs.forEach(t => t.addEventListener("click", () => activate(t.getAttribute("data-tab"))));

  function connect(){
    if (source) source.close();
    const services = Array.from(selected).join(",");
    source = new EventSource('/stream?services=' + encodeURIComponent(services));
    source.onopen = () => conn.textContent = 'Connected';
    source.onerror = () => conn.textContent = 'Disconnected';
    source.onmessage = (ev) => {
      const row = JSON.parse(ev.data);
      const q = (search.value || "").toLowerCase();
      const line = [row.service,row.level,row.message].join(" ").toLowerCase();
      if (q && !line.includes(q)) return;
      const el = document.createElement("div");
      el.className = "log-line";
      el.innerHTML = '<span class="badge">'+esc(row.service || 'system')+'</span> <span style="color:#6b7280">'+esc(row.timestamp || '')+'</span> ' + esc(row.message || '');
      logWrap.appendChild(el);
      logWrap.scrollTop = logWrap.scrollHeight;
      while (logWrap.childElementCount > 2000) logWrap.removeChild(logWrap.firstElementChild);
    };
  }

  document.querySelectorAll('.svc').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-service');
      if (!name) return;
      if (selected.has(name)) { selected.delete(name); btn.classList.remove('active'); }
      else { selected.add(name); btn.classList.add('active'); }
      connect();
    });
  });

  document.getElementById('clear').addEventListener('click', () => { logWrap.innerHTML = ''; });
  search.addEventListener('input', () => {});

  async function fetchPg(){
    const res = await fetch('/pg-stats?sort=total').then(r => r.json()).catch(() => ({queries:[], error:'Failed'}));
    if (res.error) { pgTable.innerHTML = '<div class="subtitle">'+esc(res.error)+'</div>'; return; }
    const rows = (res.queries || []).map(q => '<tr><td><code>'+esc(q.query || '')+'</code></td><td>'+ (q.calls || 0) +'</td><td>'+ Number(q.total_exec_time_ms || 0).toFixed(2) +'</td></tr>').join('');
    pgTable.innerHTML = '<table><thead><tr><th>Query</th><th>Calls</th><th>Total ms</th></tr></thead><tbody>'+rows+'</tbody></table>';
  }

  async function fetchSvc(){
    const res = await fetch('/services').then(r => r.json()).catch(() => []);
    const rows = (res || []).map(s => '<tr><td>'+esc(s.service || '')+'</td><td><code>'+esc(s.container || '')+'</code></td><td>'+esc(s.status || '')+'</td></tr>').join('');
    svcTable.innerHTML = '<table><thead><tr><th>Service</th><th>Container</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table>';
  }

  activate('logs');
  connect();
})();
`,
  ].join("\n");

  return renderPageFrame({
    title: "Supabase Log Viewer",
    subtitle: `Live logs and diagnostics on port ${input.port}.`,
    pageCss: `.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.svc.active{background:#e0e7ff}.tabs{display:flex;gap:8px;margin-bottom:10px}.tab{border:1px solid var(--border);background:var(--surface);border-radius:8px;padding:6px 10px;cursor:pointer}.tab.active{border-color:var(--accent);color:var(--accent)}.pane{min-height:420px}.log-wrap{height:420px;overflow:auto;border:1px solid var(--border);border-radius:10px;padding:8px;background:#fbfdff}.log-line{font-family:JetBrains Mono,Consolas,monospace;font-size:12px;padding:2px 0}`,
    body: (
      <>
        <div className="toolbar">
          <div>{serviceButtons}</div>
          <input id="search" className="input" placeholder="Search logs..." style={{ maxWidth: 260 }} />
          <button id="clear" className="badge">Clear</button>
          <span className="subtitle">Connection: <strong id="conn">Connecting...</strong></span>
        </div>

        <div className="tabs">
          <button className="tab active" data-tab="logs">Live Logs</button>
          <button className="tab" data-tab="pg">Query Performance</button>
          <button className="tab" data-tab="svc">Service Health</button>
        </div>

        <section className="pane" data-pane="logs">
          <div id="logs" className="log-wrap"></div>
        </section>
        <section className="pane hidden" data-pane="pg">
          <div id="pg-table" className="surface table-wrap" style={{ padding: 10 }}></div>
        </section>
        <section className="pane hidden" data-pane="svc">
          <div id="svc-table" className="surface table-wrap" style={{ padding: 10 }}></div>
        </section>
      </>
    ),
    script,
  });
}
