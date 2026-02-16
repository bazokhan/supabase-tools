/**
 * Atlas UI contributions for plugin-frontend-usage — Frontend Usage section.
 */
import { buildAtlasUI, type AtlasSectionDef } from "@sbtools/sdk";
import { frontendUsageStyles } from "./atlas/styles.js";

const FW_SUMMARY_JS = `
      var summary = document.getElementById("frontend-usage-summary");
      if (summary && data.categories.frontend_usage) {
        var items = data.categories.frontend_usage;
        var comps = items.length;
        var tables = 0, rpcs = 0;
        var seenT = {}, seenR = {};
        items.forEach(function(it) {
          (it.resources || []).forEach(function(r) {
            if (r.type === "table" && !seenT[r.resource]) { seenT[r.resource]=1; tables++; }
            if (r.type === "rpc" && !seenR[r.resource]) { seenR[r.resource]=1; rpcs++; }
          });
        });
        summary.innerHTML = '<div class="fw-stat"><span class="fw-stat-value">' + comps + '</span><span class="fw-stat-label">components</span></div>' +
          '<div class="fw-stat"><span class="fw-stat-value">' + tables + '</span><span class="fw-stat-label">tables</span></div>' +
          '<div class="fw-stat"><span class="fw-stat-value">' + rpcs + '</span><span class="fw-stat-label">RPCs</span></div>';
      }
`;

const FW_CARD_JS = `
      var search = [item.component].concat((item.resources || []).map(function(r) { return r.resource; })).join(" ").toLowerCase();
      var badges = (item.resources || []).slice(0, 8).map(function(r) {
        var typeLabel = r.type === "table" ? "Table" : r.type === "rpc" ? "RPC" : r.type === "auth" ? "Auth" : r.type === "storage" ? "Storage" : r.type === "edge_function" ? "Edge Fn" : r.type;
        return '<span class="badge fw-res" title="' + esc(typeLabel) + '">' + esc(r.resource) + '</span>';
      }).join("");
      var more = (item.resources || []).length > 8 ? '<span class="more">+' + ((item.resources || []).length - 8) + '</span>' : "";
      return '<details class="card db-card" data-kind="frontend_usage" data-search="' + esc(search) + '">' +
        '<summary><div><div class="card-title">' + esc(item.component) + '</div><div class="card-sub">' + (item.hitCount || 0) + ' usages</div></div><div class="badge-group">' + badges + more + '</div></summary>' +
        '<div class="card-body"><div class="detail-grid"><div class="detail"><h4>Resources</h4>' +
        (item.resources || []).map(function(r) { return '<code>' + esc(r.type + ': ' + r.resource) + '</code>'; }).join('<br>') +
        '</div></div></div></details>';
`;

const sections: AtlasSectionDef[] = [
  {
    id: "frontend-usage",
    title: "Frontend Usage",
    description:
      "Components and their Supabase SDK usage (tables, RPCs, auth, storage, edge functions).",
    kind: "frontend_usage",
    kindLabel: "Frontend Usage",
    listId: "frontend-usage-list",
    dataKey: "frontend_usage",
    rendererName: "renderFrontendUsageCard",
    emptyLabel: "components",
    customCardRendererJs: FW_CARD_JS.trim(),
    summary: {
      containerId: "frontend-usage-summary",
      containerClass: "frontend-usage-stats",
      rendererName: "renderFrontendUsageSummary",
      customJs: FW_SUMMARY_JS.trim(),
    },
  },
];

export function getFrontendUsageAtlasUI() {
  return buildAtlasUI(sections, frontendUsageStyles());
}
