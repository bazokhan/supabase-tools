import React from "react";
import { useAtlasData } from "../hooks/useAtlasData";
import { useDashboardConfig } from "../hooks/useDashboardConfig";
import { GenericSection } from "../components/GenericSection";

export function Depgraph() {
  const { data, loading, error } = useAtlasData();
  const { sections } = useDashboardConfig();
  const categories = data?.categories ?? {};
  const depgraphSections = sections.filter((s) => s.dataKey === "dependency_graph" || s.id.includes("depgraph"));

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
          <h1 className="page-title">Dependencies</h1>
        </header>
        <p className="page-placeholder page-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="page-overview">
      <header className="page-header">
        <h1 className="page-title">Dependencies</h1>
        <p className="page-subtitle">
          Relationships between tables, functions, triggers, policies, views, enums, and types.
        </p>
      </header>
      {depgraphSections.length > 0 ? (
        depgraphSections.map((section) => (
          <GenericSection key={section.id} section={section} data={categories} />
        ))
      ) : (
        <p className="page-placeholder">No dependency graph data. Run <code>sbt generate-atlas</code> with depgraph plugin.</p>
      )}
    </div>
  );
}
