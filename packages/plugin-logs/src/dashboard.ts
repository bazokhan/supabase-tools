/**
 * Dashboard view for plugin-logs — Query Performance and Service Health.
 */
import type { DashboardView } from "@sbtools/sdk";

export function getLogsDashboardView(): DashboardView {
  return {
    sections: [
      {
        id: "query-performance",
        title: "Query Performance",
        description: "Top queries from pg_stat_statements ordered by total execution time.",
        dataKey: "query_performance",
        layout: "table",
        table: {
          columns: [
            { header: "Query", field: "query", format: "code" },
            { header: "Calls", field: "calls", format: "number" },
            { header: "Total ms", field: "total_exec_time_ms", format: "ms" },
            { header: "Mean ms", field: "mean_exec_time_ms", format: "ms" },
            { header: "Rows", field: "rows", format: "number" },
          ],
        },
      },
      {
        id: "service-health",
        title: "Service Health",
        description: "Docker container status for each Supabase service at atlas generation time.",
        dataKey: "service_health",
        layout: "cards",
        card: {
          titleField: "service",
          subtitleField: "container",
          searchFields: ["service", "container", "status"],
          badges: [
            { field: "status", toneMap: { running: "good", exited: "bad", created: "warn" } },
          ],
          details: [
            { label: "Container", field: "container", format: "code" },
            { label: "Status", field: "status" },
          ],
        },
      },
    ],
  };
}
