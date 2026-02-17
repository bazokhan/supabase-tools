import React from "react";
import { renderPageFrame, Section, StatCard, scriptJsonVar } from "../components/document.js";

export interface FrontendUsageHit {
  type: string;
  resource: string;
}

export interface FrontendUsageData {
  components: Record<string, FrontendUsageHit[]>;
  stats: Array<{ type: string; count: number }>;
  byResource: Record<string, string[]>;
}

export interface FrontendUsageScan {
  file: string;
  component: string;
  hitCount: number;
}

const typeColors: Record<string, string> = {
  table: "#1d4ed8",
  rpc: "#0f766e",
  auth: "#b45309",
  storage: "#6d28d9",
  edge_function: "#0f766e",
  rest_api: "#92400e",
};

export function renderFrontendUsagePage(data: FrontendUsageData, scanResults: FrontendUsageScan[]): string {
  const componentEntries = Object.entries(data.components);
  const totalHits = componentEntries.reduce((acc, [, hits]) => acc + hits.length, 0);

  const rows = componentEntries.map(([component, hits]) => ({
    component,
    count: hits.length,
    resources: Array.from(new Set(hits.map((h) => `${h.type}:${h.resource}`))).slice(0, 12),
  }));

  const script = [
    scriptJsonVar("__SBT_FRONTEND_ROWS", rows),
    `
(function(){
  const input = document.getElementById("search");
  const body = document.getElementById("tbody");
  const rows = window.__SBT_FRONTEND_ROWS || [];
  function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");}
  function render(q){
    const term = (q || "").toLowerCase();
    const filtered = term ? rows.filter(r => r.component.toLowerCase().includes(term)) : rows;
    body.innerHTML = filtered.map(r => {
      const chips = r.resources.map(v => {
        const parts = v.split(":");
        const c = parts[0];
        const val = parts.slice(1).join(":");
        return '<span class="badge" style="border-color:'+ (c in ${JSON.stringify(typeColors)} ? ${JSON.stringify(typeColors)}[c] : '#d1d5db') +'">'+esc(val)+'</span>';
      }).join("");
      return '<tr><td><code>'+esc(r.component)+'</code></td><td>'+chips+'</td><td>'+r.count+'</td></tr>';
    }).join("");
  }
  input.addEventListener("input", () => render(input.value));
  render("");
})();
`,
  ].join("\n");

  return renderPageFrame({
    title: "Frontend Supabase Usage",
    subtitle: "Components and their Supabase SDK usage across tables, RPCs, auth, storage, and edge functions.",
    body: (
      <>
        <div className="stats">
          <StatCard label="Components" value={componentEntries.length} />
          <StatCard label="Usage Hits" value={totalHits} />
          <StatCard label="Files Scanned" value={scanResults.length} />
          <StatCard label="Resource Types" value={data.stats.length} />
        </div>

        <Section title="Components">
          <input id="search" className="input" placeholder="Filter by component path..." />
          <div className="surface table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Resources</th>
                  <th>Count</th>
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
