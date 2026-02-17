import React from "react";
import { useAtlasData } from "../hooks/useAtlasData";
import { useDashboardConfig } from "../hooks/useDashboardConfig";
import { GenericSection } from "../components/GenericSection";

export function Migrations() {
  const { data, loading, error } = useAtlasData();
  const { sections } = useDashboardConfig();
  const categories = data?.categories ?? {};
  const migrationSections = sections.filter((s) => s.dataKey === "migration_audit" || s.id.includes("migration"));

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
          <h1 className="page-title">Migrations</h1>
        </header>
        <p className="page-placeholder page-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="page-overview">
      <header className="page-header">
        <h1 className="page-title">Migrations</h1>
        <p className="page-subtitle">
          Migration file vs database tracking. Audit status, applied dates, and drift detection.
        </p>
      </header>
      {migrationSections.length > 0 ? (
        migrationSections.map((section) => (
          <GenericSection key={section.id} section={section} data={categories} />
        ))
      ) : (
        <p className="page-placeholder">No migration audit data. Run <code>sbt generate-atlas</code> with migration-audit plugin.</p>
      )}
    </div>
  );
}
