import React from "react";
import { AlertTriangle, CheckCircle2, Clock, FileStack, FileX2 } from "lucide-react";
import { AppDataTable } from "../components/AppDataTable";
import { EmptyPanel } from "../components/EmptyPanel";
import { MiniDonutChart } from "../components/MiniDonutChart";
import { StatCard } from "../components/StatCard";
import { Tooltip } from "../components/Tooltip";
import { formatValue, toRows } from "../lib/model";
import type { PageProps } from "./page-types";

const ICON_SIZE = 20;

interface MigrationPageProps extends PageProps {
  enabled: boolean;
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
  const [refreshing, setRefreshing] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch("/api/regenerate-atlas", { method: "POST" });
    } finally {
      setRefreshing(false);
    }
  }, []);

  const filtered = rows.filter((row) => {
    if (status !== "all" && String(row.status) !== status) return false;
    if (!search.trim()) return true;
    return JSON.stringify(row).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="content-stack">
      <div className="overview-stats-row">
        <div className="overview-stat-chips">
          <Tooltip content="Total migration files on disk">
            <div>
              <StatCard label="Total" value={formatValue(summary.total)} icon={<FileStack size={ICON_SIZE} />} />
            </div>
          </Tooltip>
          <Tooltip content="Migrations applied to database">
            <div>
              <StatCard label="Applied" value={formatValue(summary.applied)} tone="good" icon={<CheckCircle2 size={ICON_SIZE} />} />
            </div>
          </Tooltip>
          <Tooltip content="Migrations on disk but not yet applied">
            <div>
              <StatCard label="Pending" value={formatValue(summary.pending)} tone="warn" icon={<Clock size={ICON_SIZE} />} />
            </div>
          </Tooltip>
          <Tooltip content="Migrations in database but missing on disk">
            <div>
              <StatCard label="Missing" value={formatValue(summary.missing)} tone="bad" icon={<FileX2 size={ICON_SIZE} />} />
            </div>
          </Tooltip>
          <Tooltip content="Validation issues detected">
            <div>
              <StatCard
                label="Issues"
                value={formatValue(summary.issues)}
                tone={Number(summary.issues) > 0 ? "bad" : "default"}
                icon={<AlertTriangle size={ICON_SIZE} />}
              />
            </div>
          </Tooltip>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Migration Inventory</h2>
          <button type="button" className="btn" onClick={refresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
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
