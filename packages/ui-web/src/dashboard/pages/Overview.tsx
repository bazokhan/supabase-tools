import React from "react";
import {
  AlignLeft,
  Box,
  Code2,
  Database,
  Eye,
  GitMerge,
  Globe,
  Hash,
  Layers,
  List,
  Monitor,
  Network,
  Share2,
  ShieldCheck,
  Table,
  Tag,
  Zap,
} from "lucide-react";
import { AppDataTable } from "../components/AppDataTable";
import { Dropdown } from "../components/Dropdown";
import { EmptyState } from "../components/EmptyState";
import { StatCard } from "../components/StatCard";
import { Tooltip } from "../components/Tooltip";
import { getPrimaryKey, getSectionPrimaryKeyField, prettyLabel, toRows } from "../lib/model";
import type { PageProps } from "./page-types";

const ICON_SIZE = 20;

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  functions:         <Code2 size={ICON_SIZE} />,
  policies:          <ShieldCheck size={ICON_SIZE} />,
  triggers:          <Zap size={ICON_SIZE} />,
  views:             <Eye size={ICON_SIZE} />,
  materialized_views:<Database size={ICON_SIZE} />,
  types:             <Tag size={ICON_SIZE} />,
  enums:             <List size={ICON_SIZE} />,
  edge_functions:    <Globe size={ICON_SIZE} />,
  tables:            <Table size={ICON_SIZE} />,
  columns:           <AlignLeft size={ICON_SIZE} />,
  indexes:           <Hash size={ICON_SIZE} />,
  schemas:           <Layers size={ICON_SIZE} />,
  migration_audit:   <GitMerge size={ICON_SIZE} />,
  dependency_graph:  <Network size={ICON_SIZE} />,
  frontend_usage:    <Monitor size={ICON_SIZE} />,
  erd_diagrams:      <Share2 size={ICON_SIZE} />,
  studio_intent_entities: <GitMerge size={ICON_SIZE} />,
};

function getEntityIcon(name: string): React.ReactNode {
  return ENTITY_ICONS[name] ?? <Box size={ICON_SIZE} />;
}

const MAX_VISIBLE_TABS = 12;

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

  const totalCount = stats.reduce((sum, s) => sum + s.count, 0);

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
    <div className="content-stack reveal-group">
      <div className="overview-stats-row reveal-item" style={{ "--reveal-index": 0 } as React.CSSProperties}>
        <div className="overview-stat-chips reveal-group">
          {stats.map((entry, index) => (
            <Tooltip key={entry.name} content={`Filter: ${prettyLabel(entry.name)}`}>
              <div className="reveal-item" style={{ "--reveal-index": index + 1 } as React.CSSProperties}>
                <StatCard
                  label={prettyLabel(entry.name)}
                  value={entry.count.toLocaleString()}
                  tone={entry.name === activeTab ? "accent" : "default"}
                  onClick={() => setActiveTab(entry.name)}
                  icon={getEntityIcon(entry.name)}
                />
              </div>
            </Tooltip>
          ))}
        </div>
      </div>

      <section className="panel reveal-item" style={{ "--reveal-index": 2 } as React.CSSProperties}>
        {totalCount === 0 ? (
          <EmptyState
            title="No entities found"
            message="Run sbt generate-atlas to populate the workspace inventory."
            iconType="alert"
          />
        ) : (
        <>
        <div className="panel-head">
          <h2>Entity Explorer</h2>
          <input
            type="search"
            className="ui-input"
            placeholder="Filter current tab"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="tab-row">
          {(() => {
            const tabNames = Object.keys(categories).filter((name) => categories[name]?.length);
            const visible = tabNames.slice(0, MAX_VISIBLE_TABS);
            const overflow = tabNames.slice(MAX_VISIBLE_TABS);
            return (
              <>
                {visible.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`tab-btn ${activeTab === name ? "active" : ""}`}
                    onClick={() => setActiveTab(name)}
                  >
                    {prettyLabel(name)}
                  </button>
                ))}
                {overflow.length > 0 ? (
                  <Dropdown trigger={<button type="button" className="tab-btn">More ({overflow.length})</button>} align="right">
                    <div className="dropdown-service-list">
                      {overflow.map((name) => (
                        <button
                          key={name}
                          type="button"
                          className={`dropdown-service-item ${activeTab === name ? "active" : ""}`}
                          onClick={() => setActiveTab(name)}
                        >
                          {prettyLabel(name)}
                        </button>
                      ))}
                    </div>
                  </Dropdown>
                ) : null}
              </>
            );
          })()}
        </div>

        <AppDataTable
          rows={rows}
          columns={columns}
          section={activeTab}
          onRowClick={(row) =>
            onOpenDetail(activeTab, getPrimaryKey(row, getSectionPrimaryKeyField(sections, activeTab)))
          }
        />
        </>
        )}
      </section>
    </div>
  );
}
