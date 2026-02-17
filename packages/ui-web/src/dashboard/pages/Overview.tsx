import React from "react";
import { AppDataTable } from "../components/AppDataTable";
import { getPrimaryKey, getSectionPrimaryKeyField, prettyLabel, toRows } from "../lib/model";
import type { PageProps } from "./page-types";

const CORE_TABS = [
  "functions",
  "policies",
  "triggers",
  "views",
  "materialized_views",
  "types",
  "enums",
  "edge_functions",
] as const;

export function OverviewPage({ categories, sections = [], onOpenDetail }: PageProps) {
  const [activeTab, setActiveTab] = React.useState<string>(CORE_TABS[0]);
  const [query, setQuery] = React.useState("");

  const stats = React.useMemo(() => {
    const entries = CORE_TABS.map((name) => ({ name, count: categories[name]?.length ?? 0 }));
    const extras = Object.entries(categories)
      .filter(([name]) => !CORE_TABS.includes(name as (typeof CORE_TABS)[number]))
      .map(([name, rows]) => ({ name, count: rows.length }));
    return [...entries, ...extras].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [categories]);

  const rows = React.useMemo(() => {
    const source = toRows(categories[activeTab] ?? []);
    if (!query.trim()) return source.slice(0, 80);
    const term = query.toLowerCase();
    return source.filter((row) => JSON.stringify(row).toLowerCase().includes(term)).slice(0, 80);
  }, [activeTab, categories, query]);

  const columns = React.useMemo(() => {
    const preferred = ["name", "schema", "signature", "table", "status", "type_kind", "returns", "component"];
    const available = new Set<string>();

    for (const row of rows.slice(0, 20)) {
      for (const key of Object.keys(row)) available.add(key);
    }

    const ordered = preferred.filter((key) => available.has(key));
    for (const key of available) {
      if (!ordered.includes(key) && ordered.length < 8) ordered.push(key);
    }
    return ordered.length ? ordered : ["name"];
  }, [rows]);

  return (
    <div className="content-stack">
      <section className="hero">
        <h1>Supabase Workspace Intelligence</h1>
        <p>Unified view of schema entities, migrations, dependency impact, runtime health, and frontend coupling.</p>
      </section>

      <section className="stat-grid">
        {stats.map((entry) => (
          <article key={entry.name} className="stat-panel" onClick={() => setActiveTab(entry.name)}>
            <div className="stat-value">{entry.count.toLocaleString()}</div>
            <div className="stat-label">{prettyLabel(entry.name)}</div>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Entity Explorer</h2>
            <p>Search, inspect, and open details for schema objects.</p>
          </div>
          <input
            type="search"
            className="ui-input"
            placeholder="Filter current tab"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="tab-row">
          {Object.keys(categories)
            .filter((name) => categories[name]?.length)
            .slice(0, 14)
            .map((name) => (
              <button
                key={name}
                type="button"
                className={`tab-btn ${activeTab === name ? "active" : ""}`}
                onClick={() => setActiveTab(name)}
              >
                {prettyLabel(name)}
              </button>
            ))}
        </div>

        <AppDataTable
          rows={rows}
          columns={columns}
          onRowClick={(row) =>
            onOpenDetail(activeTab, getPrimaryKey(row, getSectionPrimaryKeyField(sections, activeTab)))
          }
        />
      </section>
    </div>
  );
}
