/**
 * Dashboard view for plugin-depgraph — Dependency Graph section.
 */
import type { DashboardView } from "@sbtools/sdk";

export function getDepgraphDashboardView(): DashboardView {
  return {
    sections: [
      {
        id: "dependency-graph",
        title: "Dependency Graph",
        description: "Relationships between tables, functions, triggers, policies, views, enums, and types.",
        dataKey: "dependency_graph",
        itemsPath: "0.edges",
        layout: "cards",
        stats: [
          { label: "Nodes", field: "total_nodes" },
          { label: "Edges", field: "total_edges" },
        ],
        card: {
          titleField: "source_label",
          subtitleField: "target_label",
          searchFields: ["source_label", "target_label", "label"],
          badges: [{ field: "label" }],
          details: [
            { label: "Source", field: "source_id", format: "code" },
            { label: "Target", field: "target_id", format: "code" },
            { label: "Relationship", field: "label" },
          ],
        },
        link: { label: "Open interactive graph", href: "dependency-graph.html" },
      },
    ],
  };
}
