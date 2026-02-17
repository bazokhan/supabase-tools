/**
 * Dashboard view for plugin-migration-audit — Migration Audit section.
 */
import type { DashboardView } from "@sbtools/sdk";

export function getMigrationAuditDashboardView(): DashboardView {
  return {
    sections: [
      {
        id: "migration-audit",
        title: "Migration Audit",
        description: "Migration file vs database tracking comparison. Detects drift and consistency issues.",
        dataKey: "migration_audit",
        itemsStartIndex: 1,
        layout: "cards",
        stats: [
          { label: "Total", field: "total" },
          { label: "Applied", field: "applied", tone: "good" },
          { label: "Pending", field: "pending", tone: "warn" },
          { label: "Missing", field: "missing", tone: "bad" },
          { label: "Issues", field: "issues" },
        ],
        card: {
          titleField: "filename",
          subtitleField: "applied_at",
          searchFields: ["filename", "status"],
          badges: [
            { field: "status", toneMap: { applied: "good", pending: "warn", missing: "bad" } },
          ],
          details: [
            { label: "Status", field: "status" },
            { label: "Applied At", field: "applied_at", format: "date" },
            { label: "File Size", field: "size_bytes", format: "bytes" },
          ],
        },
        link: { label: "Open full audit report", href: "migration-audit.html" },
      },
    ],
  };
}
