import React from "react";
import { AppDataTable } from "../components/AppDataTable";
import { EmptyPanel } from "../components/EmptyPanel";
import { toRows } from "../lib/model";
import type { PageProps } from "./page-types";

interface FrontendPageProps extends PageProps {
  enabled: boolean;
}

export function FrontendPage({ categories, onOpenDetail, enabled }: FrontendPageProps) {
  if (!enabled) {
    return (
      <EmptyPanel
        title="Frontend Usage Plugin Not Active"
        message="No frontend usage section is currently registered in this dashboard."
        hint="Enable @sbtools/plugin-frontend-usage, run sbt frontend-usage or sbt generate-atlas, then refresh."
      />
    );
  }
  return <FrontendEnabled categories={categories} onOpenDetail={onOpenDetail} />;
}

function FrontendEnabled({ categories, onOpenDetail }: PageProps) {
  const [query, setQuery] = React.useState("");
  const rows = toRows(categories.frontend_usage ?? []);
  const filtered = rows.filter((row) => !query.trim() || JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="content-stack">
      <section className="panel panel-accent">
        <div className="panel-head">
          <div>
            <h2>Frontend to Backend Usage Map</h2>
            <p>Trace which components touch tables, RPCs, storage, auth, and edge functions.</p>
          </div>
          <input
            type="search"
            className="ui-input"
            placeholder="Search by component or resource"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </section>

      <section className="panel">
        <AppDataTable
          rows={filtered}
          columns={["component", "hitCount", "resources"]}
          onRowClick={(row) => onOpenDetail("frontend_usage", String(row.component ?? ""))}
        />
      </section>
    </div>
  );
}
