import React from "react";
import { useAtlasData } from "../hooks/useAtlasData";
import { useDashboardConfig } from "../hooks/useDashboardConfig";
import { GenericSection } from "../components/GenericSection";

export function Logs() {
  const { data, loading, error } = useAtlasData();
  const { sections } = useDashboardConfig();
  const categories = data?.categories ?? {};
  const logsSections = sections.filter(
    (s) => s.dataKey === "query_performance" || s.dataKey === "service_health" || s.id.includes("log")
  );

  if (loading) {
    return (
      <div className="page-overview">
        <p className="page-placeholder">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-overview">
        <header className="page-header">
          <h1 className="page-title">Logs & Performance</h1>
        </header>
        <p className="page-placeholder page-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="page-overview">
      <header className="page-header">
        <h1 className="page-title">Logs & Performance</h1>
        <p className="page-subtitle">
          Query performance from pg_stat_statements and Docker service health.
        </p>
      </header>
      {logsSections.length > 0 ? (
        logsSections.map((section) => (
          <GenericSection key={section.id} section={section} data={categories} />
        ))
      ) : (
        <p className="page-placeholder">
          No logs data. Run <code>sbt generate-atlas</code> with logs plugin, or use <code>sbt logs viewer</code> for live streaming.
        </p>
      )}
    </div>
  );
}
