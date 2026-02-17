/**
 * Dashboard view for plugin-frontend-usage — Frontend Usage section.
 */
import type { DashboardView } from "@sbtools/sdk";

export function getFrontendUsageDashboardView(): DashboardView {
  return {
    sections: [
      {
        id: "frontend-usage",
        title: "Frontend Usage",
        description: "Components and their Supabase SDK usage (tables, RPCs, auth, storage, edge functions).",
        dataKey: "frontend_usage",
        layout: "cards",
        card: {
          titleField: "component",
          subtitleField: "hitCount",
          searchFields: ["component", "resources"],
          details: [
            { label: "Resources", field: "resources" },
          ],
        },
      },
    ],
  };
}
