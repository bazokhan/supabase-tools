import React from "react";
import { renderPageFrame, Section, StatCard, scriptJsonVar } from "../components/document.js";

export interface MigrationAuditSummary {
  total: number;
  applied: number;
  pending: number;
  missing: number;
  errors: number;
  warnings: number;
  infos: number;
}

export interface MigrationAuditIssue {
  code: string;
  message: string;
  severity: string;
  affectedMigrations?: string[];
}

export interface MigrationAuditRow {
  filename: string;
  status: string;
  appliedAt: string | null;
  sizeBytes: number;
}

export interface MigrationAuditSchema {
  dbSize?: string;
  pgVersion?: string;
}

export interface MigrationAuditInput {
  summary: MigrationAuditSummary;
  issues: MigrationAuditIssue[];
  migrations: MigrationAuditRow[];
  schema?: MigrationAuditSchema;
}

export function renderMigrationAuditPage(input: MigrationAuditInput): string {
  const script = [
    scriptJsonVar("__SBT_AUDIT_ROWS", input.migrations),
    `
(function(){
  const rows = window.__SBT_AUDIT_ROWS || [];
  const search = document.getElementById("search");
  const tbody = document.getElementById("tbody");
  const chips = document.querySelectorAll("[data-status]");
  let activeStatus = "all";
  function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");}
  function fmtDate(s){ if(!s) return "-"; return new Date(s).toISOString().replace("T"," ").slice(0,19); }
  function fmtBytes(n){ if(n < 1024) return n + " B"; if(n < 1024*1024) return (n/1024).toFixed(1)+" KB"; return (n/(1024*1024)).toFixed(1)+" MB"; }
  function render(){
    const q = (search.value || "").toLowerCase();
    const filtered = rows.filter(r => {
      if (activeStatus !== "all" && r.status !== activeStatus) return false;
      if (!q) return true;
      return r.filename.toLowerCase().includes(q);
    });
    tbody.innerHTML = filtered.map(r => '<tr><td><span class="badge">'+esc(r.status)+'</span></td><td><code>'+esc(r.filename)+'</code></td><td>'+fmtDate(r.appliedAt)+'</td><td>'+fmtBytes(r.sizeBytes || 0)+'</td></tr>').join("");
  }
  chips.forEach(ch => {
    ch.addEventListener("click", () => {
      chips.forEach(c => c.classList.remove("active"));
      ch.classList.add("active");
      activeStatus = ch.getAttribute("data-status") || "all";
      render();
    });
  });
  search.addEventListener("input", render);
  render();
})();
`,
  ].join("\n");

  const issues = input.issues.map((i) => (
    <div className="surface" style={{ padding: 12, marginBottom: 8 }} key={`${i.code}-${i.message}`}>
      <div style={{ fontWeight: 600 }}>{i.code}</div>
      <div style={{ color: "var(--text-muted)", fontSize: "0.92rem" }}>{i.message}</div>
    </div>
  ));

  return renderPageFrame({
    title: "Migration Audit",
    subtitle: "Compare migration files on disk with migration history in the database.",
    pageCss: `.chipbar{display:flex;gap:8px;flex-wrap:wrap}.chipbar button{border:1px solid var(--border);border-radius:999px;background:var(--surface);padding:6px 10px;cursor:pointer}.chipbar button.active{border-color:var(--accent);color:var(--accent);}`,
    body: (
      <>
        <div className="stats">
          <StatCard label="Total" value={input.summary.total} />
          <StatCard label="Applied" value={input.summary.applied} tone="good" />
          <StatCard label="Pending" value={input.summary.pending} tone="warn" />
          <StatCard label="Missing" value={input.summary.missing} tone="bad" />
          <StatCard label="Issues" value={input.summary.errors + input.summary.warnings + input.summary.infos} />
          {input.schema?.dbSize ? <StatCard label="DB Size" value={input.schema.dbSize} /> : null}
        </div>

        <Section title="Issues">{issues.length ? issues : <div className="subtitle">No issues detected.</div>}</Section>

        <Section title="Migrations">
          <div className="chipbar">
            <button data-status="all" className="active">All</button>
            <button data-status="applied">Applied</button>
            <button data-status="pending">Pending</button>
            <button data-status="missing">Missing</button>
          </div>
          <input id="search" className="input" placeholder="Filter by filename..." style={{ marginTop: 10 }} />
          <div className="surface table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Filename</th>
                  <th>Applied At</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody id="tbody"></tbody>
            </table>
          </div>
        </Section>
      </>
    ),
    script,
  });
}
