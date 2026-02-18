import React from "react";
import { AppDataTable } from "../components/AppDataTable";
import { EmptyPanel } from "../components/EmptyPanel";
import { MiniDonutChart } from "../components/MiniDonutChart";
import { StatCard } from "../components/StatCard";
import { Tooltip } from "../components/Tooltip";
import {
  DEFAULT_STUDIO_URL,
  STUDIO_URL_STORAGE_KEY,
  formatValue,
  readStudioUrl,
  toRows,
} from "../lib/model";
import type { PageProps } from "./page-types";

interface MigrationPageProps extends PageProps {
  enabled: boolean;
}

function getSafeStudioUrl(rawUrl: string): string {
  const fallback = DEFAULT_STUDIO_URL;
  const trimmed = rawUrl.trim();
  if (!trimmed) return fallback;
  try {
    const url = new URL(trimmed, window.location.origin);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function MigrationsPage({ categories, onOpenDetail, enabled }: MigrationPageProps) {
  if (!enabled) {
    return (
      <EmptyPanel
        title="Migration Plugin Not Active"
        message="No migration audit section is currently registered in this dashboard."
        hint="Enable @sbtools/plugin-migration-audit, run sbt migration-audit, then refresh."
      />
    );
  }
  return <MigrationsEnabled categories={categories} onOpenDetail={onOpenDetail} />;
}

function MigrationsEnabled({ categories, onOpenDetail }: PageProps) {
  const allRows = toRows(categories.migration_audit ?? []);
  const summary = allRows.find((row) => typeof row.total === "number") ?? {};
  const rows = allRows.filter((row) => typeof row.filename === "string");

  const [status, setStatus] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [studioUrl, setStudioUrl] = React.useState(readStudioUrl);
  const [embedStudio, setEmbedStudio] = React.useState(false);

  React.useEffect(() => {
    localStorage.setItem(STUDIO_URL_STORAGE_KEY, studioUrl.trim() || DEFAULT_STUDIO_URL);
  }, [studioUrl]);

  const filtered = rows.filter((row) => {
    if (status !== "all" && String(row.status) !== status) return false;
    if (!search.trim()) return true;
    return JSON.stringify(row).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="content-stack">
      <section className="panel panel-accent">
        <div className="panel-head">
          <div>
            <h2>Migration Control Center</h2>
            <p>Track drift, inspect every migration, and jump into Studio fast.</p>
          </div>
          <div className="cluster-row">
            <a className="btn" href="/migration-audit.html" target="_blank" rel="noreferrer">
              Full Audit Report
            </a>
            <button type="button" className="btn" onClick={() => setEmbedStudio((value) => !value)}>
              {embedStudio ? "Hide Embedded Studio" : "Open Embedded Studio"}
            </button>
            <a className="btn btn-primary" href={getSafeStudioUrl(studioUrl)} target="_blank" rel="noreferrer">
              Open Migration Studio
            </a>
          </div>
        </div>

        <div className="studio-url-row">
          <label htmlFor="studio-url">Studio URL</label>
          <input
            id="studio-url"
            className="ui-input"
            value={studioUrl}
            onChange={(event) => setStudioUrl(event.target.value)}
            placeholder="http://localhost:3335"
          />
        </div>
      </section>

      {embedStudio ? (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Embedded Migration Studio</h2>
              <p>Studio is embedded for a single unified workflow. Use pop-out if auth/cookies block iframe loading.</p>
            </div>
            <a className="btn" href={getSafeStudioUrl(studioUrl)} target="_blank" rel="noreferrer">
              Pop Out
            </a>
          </div>
          <iframe
            title="Migration Studio"
            src={getSafeStudioUrl(studioUrl)}
            className="studio-embed-frame"
          />
        </section>
      ) : null}

      <section className="stat-grid compact">
        <Tooltip content="Total migration files on disk">
          <div><StatCard label="Total" value={formatValue(summary.total)} /></div>
        </Tooltip>
        <Tooltip content="Migrations applied to database">
          <div><StatCard label="Applied" value={formatValue(summary.applied)} tone="good" /></div>
        </Tooltip>
        <Tooltip content="Migrations on disk but not yet applied">
          <div><StatCard label="Pending" value={formatValue(summary.pending)} tone="warn" /></div>
        </Tooltip>
        <Tooltip content="Migrations in database but missing on disk">
          <div><StatCard label="Missing" value={formatValue(summary.missing)} tone="bad" /></div>
        </Tooltip>
        <Tooltip content="Validation issues detected">
          <div>
            <StatCard
              label="Issues"
              value={formatValue(summary.issues)}
              tone={Number(summary.issues) > 0 ? "bad" : "default"}
            />
          </div>
        </Tooltip>
      </section>

      {rows.length > 0 && (
        <section className="panel">
          <h3 className="chart-section-title">Migration status</h3>
          <MiniDonutChart
            segments={[
              { label: "Applied", value: Number(summary.applied) || 0, color: "var(--success)" },
              { label: "Pending", value: Number(summary.pending) || 0, color: "var(--warning)" },
              { label: "Missing", value: Number(summary.missing) || 0, color: "var(--danger)" },
            ].filter((s) => s.value > 0)}
            size={120}
          />
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Migration Inventory</h2>
            <p>Click any migration for detailed metadata and SQL payload.</p>
          </div>
          <input
            type="search"
            className="ui-input"
            placeholder="Search by filename"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="tab-row">
          {[
            { key: "all", label: "All" },
            { key: "applied", label: "Applied" },
            { key: "pending", label: "Pending" },
            { key: "missing", label: "Missing" },
          ].map((option) => (
            <button
              type="button"
              key={option.key}
              className={`tab-btn ${status === option.key ? "active" : ""}`}
              onClick={() => setStatus(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <AppDataTable
          rows={filtered}
          columns={["filename", "status", "applied_at", "size_bytes"]}
          onRowClick={(row) => onOpenDetail("migration_audit", String(row.filename ?? ""))}
        />
      </section>
    </div>
  );
}
