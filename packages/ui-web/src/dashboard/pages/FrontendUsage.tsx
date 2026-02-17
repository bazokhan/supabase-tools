import React from "react";
import { useAtlasData } from "../hooks/useAtlasData";
import { useDashboardConfig } from "../hooks/useDashboardConfig";
import { GenericSection } from "../components/GenericSection";

export function FrontendUsage() {
  const { data, loading, error } = useAtlasData();
  const { sections } = useDashboardConfig();
  const categories = data?.categories ?? {};
  const frontendSections = sections.filter(
    (s) => s.dataKey === "frontend_usage" || s.id.includes("frontend")
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
          <h1 className="page-title">Frontend Usage</h1>
        </header>
        <p className="page-placeholder page-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="page-overview">
      <header className="page-header">
        <h1 className="page-title">Frontend Usage</h1>
        <p className="page-subtitle">
          Components and their Supabase SDK usage (tables, RPCs, auth, storage, edge functions).
        </p>
      </header>
      {frontendSections.length > 0 ? (
        frontendSections.map((section) => (
          <GenericSection key={section.id} section={section} data={categories} />
        ))
      ) : (
        <p className="page-placeholder">No frontend usage data. Run <code>sbt frontend-usage</code> and <code>sbt generate-atlas</code>.</p>
      )}
    </div>
  );
}
