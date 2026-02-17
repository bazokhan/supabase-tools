import React from "react";
import { useAtlasData } from "../hooks/useAtlasData";
import { useDashboardConfig } from "../hooks/useDashboardConfig";
import { GenericSection } from "../components/GenericSection";
import { StatCard } from "../components/StatCard";

export function Overview() {
  const { data, loading, error } = useAtlasData();
  const { sections } = useDashboardConfig();
  const categories = data?.categories ?? {};

  if (loading) {
    return (
      <div className="page-overview">
        <p className="page-placeholder">Loading atlas data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-overview">
        <header className="page-header">
          <h1 className="page-title">Overview</h1>
        </header>
        <p className="page-placeholder page-error">
          {error}. Run <code>sbt dashboard</code> to start the server.
        </p>
      </div>
    );
  }

  const counts = data?.meta?.object_counts ?? {};
  const coreStats = [
    { label: "Functions", value: counts.functions ?? 0 },
    { label: "Views", value: counts.views ?? 0 },
    { label: "Materialized Views", value: counts.materialized_views ?? 0 },
    { label: "Triggers", value: counts.triggers ?? 0 },
    { label: "Policies", value: counts.policies ?? 0 },
    { label: "Types", value: counts.types ?? 0 },
    { label: "Enums", value: counts.enums ?? 0 },
  ];

  return (
    <div className="page-overview">
      <header className="page-header">
        <h1 className="page-title">Overview</h1>
        <p className="page-subtitle">
          Backend snapshot: functions, policies, triggers, views, types, and enums. Snapshot:{" "}
          {data?.meta?.timestamp ? new Date(data.meta.timestamp).toLocaleString() : "—"}
        </p>
      </header>
      <div className="dashboard-stats">
        {coreStats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} />
        ))}
      </div>
      {sections.map((section) => (
        <GenericSection key={section.id} section={section} data={categories} />
      ))}
    </div>
  );
}
