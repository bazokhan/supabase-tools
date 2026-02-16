/**
 * Atlas UI contributions for plugin-depgraph — Dependency Graph section.
 */
import { buildAtlasUI, type AtlasSectionDef } from "@sbtools/sdk";
import { depgraphStyles } from "./atlas/styles.js";

const DEPGRAPH_SUMMARY_JS = `
      var dg = data.categories.dependency_graph;
      if (!dg || !dg.length) return;
      var info = dg[0];
      var container = document.getElementById("depgraph-summary");
      if (!container) return;
      var html = '<div class="depgraph-stats">';
      html += '<div class="depgraph-stat"><span class="depgraph-stat-value">' + (info.total_nodes || 0) + '</span><span class="depgraph-stat-label">Nodes</span></div>';
      html += '<div class="depgraph-stat"><span class="depgraph-stat-value">' + (info.total_edges || 0) + '</span><span class="depgraph-stat-label">Edges</span></div>';
      if (info.relationship_counts) {
        var keys = Object.keys(info.relationship_counts);
        for (var i = 0; i < keys.length; i++) {
          html += '<div class="depgraph-stat"><span class="depgraph-stat-value">' + info.relationship_counts[keys[i]] + '</span><span class="depgraph-stat-label">' + esc(keys[i]) + '</span></div>';
        }
      }
      html += '</div>';
      html += '<a class="depgraph-link" href="dependency-graph.html" target="_blank">Open interactive graph &rarr;</a>';
      container.innerHTML = html;
`;

const sections: AtlasSectionDef[] = [
  {
    id: "dependency-graph",
    title: "Dependency Graph",
    description:
      "Relationships between tables, functions, triggers, policies, views, enums, and types.",
    kind: "dependency_graph",
    kindLabel: "Dependency Graph",
    listId: "depgraph-rel-list",
    dataKey: "dependency_graph",
    rendererName: "renderDepgraphRelCard",
    emptyLabel: "relationships",
    itemsExpr:
      "(data.categories.dependency_graph && data.categories.dependency_graph[0] && data.categories.dependency_graph[0].edges) || []",
    card: {
      searchFields: ["item.source_label", "item.target_label", "item.label"],
      title: "item.source_label + ' &rarr; ' + item.target_label",
      subtitle: "item.source_type + ' &rarr; ' + item.target_type",
      badges: [{ label: "item.label", cssClass: "dg-rel" }],
      details: [
        { heading: "Source", value: "item.source_id" },
        { heading: "Target", value: "item.target_id" },
        { heading: "Relationship", value: "item.label" },
      ],
    },
    summary: {
      containerId: "depgraph-summary",
      containerClass: "depgraph-summary",
      rendererName: "renderDepgraphSummary",
      customJs: DEPGRAPH_SUMMARY_JS.trim(),
    },
  },
];

export function getDepgraphAtlasUI() {
  return buildAtlasUI(sections, depgraphStyles());
}
