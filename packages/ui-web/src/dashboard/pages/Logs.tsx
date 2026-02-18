import React from "react";
import { AppDataTable } from "../components/AppDataTable";
import { Badge } from "../components/Badge";
import { Dropdown } from "../components/Dropdown";
import { EmptyPanel } from "../components/EmptyPanel";
import { EmptyState } from "../components/EmptyState";
import { toRows, type CategoryMap } from "../lib/model";

interface LogsPageProps {
  categories: CategoryMap;
  enabled: boolean;
}

interface LiveLogLine {
  service: string;
  level: string;
  timestamp: string;
  message: string;
}

interface ServiceStatus {
  service: string;
  container: string;
  running: boolean;
  status: string;
}

function useLiveLogs(active: boolean, services: string[]) {
  const [lines, setLines] = React.useState<LiveLogLine[]>([]);
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    if (!active || services.length === 0) return;
    const source = new EventSource(`/api/logs/stream?services=${encodeURIComponent(services.join(","))}`);

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      try {
        const line = JSON.parse(event.data) as LiveLogLine;
        setLines((current) => {
          const next = [...current, line];
          return next.length > 1200 ? next.slice(next.length - 1200) : next;
        });
      } catch {
        // Ignore malformed line
      }
    };

    return () => {
      source.close();
      setConnected(false);
    };
  }, [active, services]);

  return { lines, connected, setLines };
}

export function LogsPage({ categories, enabled }: LogsPageProps) {
  if (!enabled) {
    return (
      <EmptyPanel
        title="Logs Plugin Not Active"
        message="No query performance or service health sections are currently registered."
        hint="Enable @sbtools/plugin-logs, run sbt generate-atlas, then refresh."
      />
    );
  }

  return <LogsEnabled categories={categories} />;
}

function LogsEnabled({ categories }: { categories: CategoryMap }) {
  const [activeTab, setActiveTab] = React.useState<"live" | "queries" | "services">("live");
  const [filter, setFilter] = React.useState("");
  const [serviceStatuses, setServiceStatuses] = React.useState<ServiceStatus[]>([]);
  const [selectedServices, setSelectedServices] = React.useState<string[]>([]);
  const logContainerRef = React.useRef<HTMLDivElement | null>(null);

  const queries = toRows(categories.query_performance ?? []);
  const services = toRows(categories.service_health ?? []);

  React.useEffect(() => {
    fetch("/api/logs/services")
      .then((response) => response.json())
      .then((payload) => {
        const rows = Array.isArray(payload) ? (payload as ServiceStatus[]) : [];
        setServiceStatuses(rows);
        setSelectedServices(rows.map((row) => row.service));
      })
      .catch(() => setServiceStatuses([]));
  }, []);

  const { lines, connected, setLines } = useLiveLogs(activeTab === "live", selectedServices);

  React.useEffect(() => {
    const el = logContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  const filteredLines = lines.filter((line) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return `${line.service} ${line.level} ${line.message}`.toLowerCase().includes(q);
  });

  const toggleService = (service: string) => {
    setSelectedServices((current) =>
      current.includes(service) ? current.filter((item) => item !== service) : [...current, service]
    );
    setLines([]);
  };

  return (
    <div className="content-stack">
      <section className="panel panel-accent">
        <h2>Runtime Health and Performance</h2>
        <p>Live logs + snapshot metrics. Stream is sourced from dashboard backend in real time.</p>
      </section>

      <section className="panel">
        <div className="tab-row">
          <button type="button" className={`tab-btn ${activeTab === "live" ? "active" : ""}`} onClick={() => setActiveTab("live")}>Live Logs</button>
          <button type="button" className={`tab-btn ${activeTab === "queries" ? "active" : ""}`} onClick={() => setActiveTab("queries")}>Query Performance</button>
          <button type="button" className={`tab-btn ${activeTab === "services" ? "active" : ""}`} onClick={() => setActiveTab("services")}>Service Health</button>
        </div>

        {activeTab === "live" ? (
          <>
            <div className="panel-head">
              {serviceStatuses.length <= 6 ? (
                <div className="cluster-row">
                  {serviceStatuses.map((status) => (
                    <button
                      key={status.service}
                      type="button"
                      className={`tab-btn ${selectedServices.includes(status.service) ? "active" : ""}`}
                      onClick={() => toggleService(status.service)}
                    >
                      {status.service}
                    </button>
                  ))}
                </div>
              ) : (
                <Dropdown
                  trigger={
                    <button type="button" className="btn">
                      Services ({selectedServices.length}/{serviceStatuses.length} selected)
                    </button>
                  }
                  align="left"
                >
                  <div className="dropdown-service-list">
                    {serviceStatuses.map((status) => (
                      <label key={status.service} className="dropdown-service-item">
                        <input
                          type="checkbox"
                          checked={selectedServices.includes(status.service)}
                          onChange={() => toggleService(status.service)}
                        />
                        <span>{status.service}</span>
                      </label>
                    ))}
                  </div>
                </Dropdown>
              )}
              <input
                type="search"
                className="ui-input"
                placeholder="Filter live logs"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            </div>

            <div className="live-status-row">
              <Badge tone={connected ? "good" : "bad"}>
                {connected ? "Connected" : "Disconnected"}
              </Badge>
              <button type="button" className="btn" onClick={() => setLines([])}>Clear</button>
              <span className="empty-state">Showing {filteredLines.length} lines</span>
            </div>

            <div className="log-live-surface" ref={logContainerRef}>
              {filteredLines.length === 0 ? (
                <EmptyState title="No log lines" message="Logs will appear here when services emit output." iconType="alert" />
              ) : (
                <>
                  {filteredLines.map((line, index) => (
                    <div key={`${line.service}-${line.timestamp}-${index}`} className={`log-line log-${line.level || "info"}`}>
                      <span className="log-service">{line.service}</span>
                      <span className="log-ts">{line.timestamp || "--:--:--"}</span>
                      <span className="log-msg">{line.message}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        ) : null}

        {activeTab === "queries" ? (
          <AppDataTable rows={queries} columns={["query", "calls", "total_exec_time_ms", "mean_exec_time_ms", "rows"]} />
        ) : null}

        {activeTab === "services" ? (
          <AppDataTable rows={services} columns={["service", "container", "status"]} />
        ) : null}
      </section>
    </div>
  );
}
