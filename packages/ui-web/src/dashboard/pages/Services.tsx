import React from "react";
import { AppDataTable } from "../components/AppDataTable";
import { Badge } from "../components/Badge";
import { useDashboardEvents } from "../hooks/useDashboardEvents";
import { toRows, type AtlasRow } from "../lib/model";
import { useServices } from "../hooks/useServices";

export function ServicesPage() {
  const { services, uiEndpoints, docsSpecPresent, loading, error, refresh } = useServices();

  useDashboardEvents(
    React.useCallback((event) => {
      if (event.type === "command:finished" || event.type === "command:started" || event.type === "command:stopping") {
        refresh();
      }
    }, [refresh]),
  );

  if (loading) {
    return <section className="panel"><p className="empty-state">Loading services...</p></section>;
  }
  if (error) {
    return <section className="panel"><p className="empty-state">{error}</p></section>;
  }

  const serviceRows = toRows(services as unknown[]) as AtlasRow[];

  return (
    <div className="content-stack">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Local Services</h2>
            <p>Docker container status and quick links for related UIs.</p>
          </div>
          <button type="button" className="btn" onClick={() => refresh()}>Refresh</button>
        </div>
        <AppDataTable rows={serviceRows} columns={["service", "container", "status"]} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>UI Endpoints</h3>
            <p>{docsSpecPresent ? "OpenAPI spec file detected in .sbt." : "OpenAPI spec file not found yet."}</p>
          </div>
        </div>
        <div className="service-link-grid">
          {uiEndpoints.map((item) => (
            <article key={item.id} className="service-link-card">
              <div className="service-link-head">
                <strong>{item.label}</strong>
                <Badge tone={item.reachable ? "good" : "warn"}>{item.reachable ? "Reachable" : "Down"}</Badge>
              </div>
              <p><code>{item.url}</code></p>
              <div className="cluster-row">
                <Badge tone="default">{item.source}</Badge>
                <a className="btn-primary-sm service-open-link" href={item.url} target="_blank" rel="noreferrer">Open</a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
