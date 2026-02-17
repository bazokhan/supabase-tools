/**
 * Dashboard view for plugin-deno-functions — Edge Functions section.
 */
import type { DashboardView } from "@sbtools/sdk";

export function getEdgeFunctionDashboardView(): DashboardView {
  return {
    sections: [
      {
        id: "edge-functions",
        title: "Edge Functions",
        description: "Serverless Deno functions invoked via HTTP. Includes endpoint, auth, request/response schemas.",
        dataKey: "edge_functions",
        layout: "cards",
        card: {
          titleField: "name",
          subtitleField: "endpoint",
          searchFields: ["name", "endpoint", "auth_type"],
          badges: [
            { field: "auth_type", toneMap: { jwt: "accent", service_role: "warn", public: "good" } },
          ],
          details: [
            { label: "Endpoint", field: "endpoint", format: "code" },
            { label: "Description", field: "description" },
          ],
        },
      },
    ],
  };
}
