/**
 * Atlas UI contributions for plugin-logs — Query Performance and Service Health.
 */
import { buildAtlasUI, type AtlasSectionDef } from "@sbtools/sdk";
import { logsStyles } from "./atlas/styles.js";

const sections: AtlasSectionDef[] = [
  {
    id: "query-performance",
    title: "Query Performance",
    description: "Top queries from pg_stat_statements ordered by total execution time.",
    kind: "query_performance",
    kindLabel: "Query Performance",
    listId: "query-performance-list",
    dataKey: "query_performance",
    rendererName: "renderQueryPerfCard",
    emptyLabel: "queries",
    card: {
      searchFields: ["item.query", "String(item.calls)"],
      title: "item.query.length > 80 ? item.query.substring(0, 80) + '...' : item.query",
      subtitle: "'Total: ' + item.total_exec_time_ms.toFixed(2) + 'ms  |  Mean: ' + item.mean_exec_time_ms.toFixed(2) + 'ms  |  Rows: ' + item.rows.toLocaleString()",
      badges: [
        { label: "item.calls.toLocaleString() + ' calls'", cssClass: "qp-calls" },
        { label: "'slow'", cssClass: "qp-slow", condition: "item.mean_exec_time_ms > 100" },
        {
          label: "item.hit_rate + ' cache'",
          condition: "item.hit_rate && item.hit_rate !== 'n/a'",
        },
      ],
      details: [
        { heading: "Full Query", value: "item.query", pre: true },
        { heading: "Calls", value: "item.calls.toLocaleString()" },
        { heading: "Total Time", value: "item.total_exec_time_ms.toFixed(2) + ' ms'" },
        { heading: "Mean Time", value: "item.mean_exec_time_ms.toFixed(2) + ' ms'" },
        { heading: "Rows Returned", value: "item.rows.toLocaleString()" },
        { heading: "Cache Hit Rate", value: "item.hit_rate || 'n/a'" },
      ],
    },
  },
  {
    id: "service-health",
    title: "Service Health",
    description: "Docker container status for each Supabase service at atlas generation time.",
    kind: "service_health",
    kindLabel: "Service Health",
    listId: "service-health-list",
    dataKey: "service_health",
    rendererName: "renderServiceHealthCard",
    emptyLabel: "services",
    card: {
      searchFields: ["item.service", "item.container", "item.status"],
      title: "item.service",
      subtitle: "item.container",
      badges: [
        { label: "'running'", cssClass: "sh-running", condition: "item.running" },
        { label: "item.status", cssClass: "sh-stopped", condition: "!item.running" },
      ],
      details: [
        { heading: "Container", value: "item.container" },
        { heading: "Status", value: "item.status" },
      ],
    },
  },
];

export function getLogsAtlasUI() {
  return buildAtlasUI(sections, logsStyles());
}
