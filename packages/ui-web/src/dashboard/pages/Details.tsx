import React from "react";
import { IconExternal, IconFile } from "../components/Icons";
import { ValueRenderer } from "../components/ValueRenderer";
import { findDetailTarget, getPrimaryKey, prettyLabel, type CategoryMap } from "../lib/model";
import type { DashboardSectionDef } from "@sbtools/sdk";

interface DetailsPageProps {
  categories: CategoryMap;
  search: URLSearchParams;
  sections?: DashboardSectionDef[];
}

interface FileTarget {
  label: string;
  href: string;
}

function safeSegment(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function getFileTargets(section: string, row: Record<string, unknown>): FileTarget[] {
  const targets: FileTarget[] = [];

  if (section === "migration_audit" && row.filename) {
    targets.push({
      label: "Migration SQL",
      href: `/api/fs/file?scope=migrations&path=${encodeURIComponent(String(row.filename))}`,
    });
  }

  if (section === "functions" && row.schema && row.name) {
    targets.push({
      label: "Function Snapshot",
      href: `/api/fs/file?scope=snapshot&path=${encodeURIComponent(`functions/${safeSegment(row.schema)}.${safeSegment(row.name)}.sql`)}`,
    });
  }

  if (section === "views" && row.schema && row.name) {
    targets.push({
      label: "View Snapshot",
      href: `/api/fs/file?scope=snapshot&path=${encodeURIComponent(`views/${safeSegment(row.schema)}.${safeSegment(row.name)}.sql`)}`,
    });
  }

  if (section === "materialized_views" && row.schema && row.name) {
    targets.push({
      label: "Materialized View Snapshot",
      href: `/api/fs/file?scope=snapshot&path=${encodeURIComponent(`views/${safeSegment(row.schema)}.${safeSegment(row.name)}.materialized.sql`)}`,
    });
  }

  if (section === "triggers" && row.schema && row.table && row.name) {
    targets.push({
      label: "Trigger Snapshot",
      href: `/api/fs/file?scope=snapshot&path=${encodeURIComponent(`triggers/${safeSegment(row.schema)}.${safeSegment(row.table)}.${safeSegment(row.name)}.sql`)}`,
    });
  }

  if (section === "policies" && row.schema && row.table) {
    targets.push({
      label: "Policies Snapshot",
      href: `/api/fs/file?scope=snapshot&path=${encodeURIComponent(`policies/${safeSegment(row.schema)}.${safeSegment(row.table)}.sql`)}`,
    });
  }

  if (section === "types" && row.schema && row.name) {
    targets.push({
      label: "Type Snapshot",
      href: `/api/fs/file?scope=snapshot&path=${encodeURIComponent(`types/${safeSegment(row.schema)}.${safeSegment(row.name)}.sql`)}`,
    });
  }

  if (section === "enums" && row.schema && row.name) {
    targets.push({
      label: "Enum Snapshot",
      href: `/api/fs/file?scope=snapshot&path=${encodeURIComponent(`enums/${safeSegment(row.schema)}.${safeSegment(row.name)}.sql`)}`,
    });
  }

  if (section === "dependency_graph") {
    targets.push({
      label: "Dependency Graph HTML",
      href: `/api/fs/file?scope=docs&path=${encodeURIComponent("dependency-graph.html")}`,
    });
  }

  if (section === "frontend_usage" && row.component) {
    const component = String(row.component);
    if (!component.startsWith("http")) {
      targets.push({
        label: "Component Source",
        href: `/api/fs/file?scope=project&path=${encodeURIComponent(component)}`,
      });
    }
  }

  return targets;
}

function isWideField(field: string, value: unknown): boolean {
  if (field.includes("sql") || field === "query" || field === "resources") return true;
  if (Array.isArray(value)) return value.length > 4;
  if (typeof value === "string") return value.length > 160;
  if (value && typeof value === "object") return true;
  return false;
}

export function DetailsPage({ categories, search, sections = [] }: DetailsPageProps) {
  const section = search.get("section") ?? "";
  const key = search.get("key") ?? "";
  const target = findDetailTarget(categories, section, key, sections);

  if (!target) {
    return (
      <section className="panel">
        <h2>Detail Not Found</h2>
        <p className="empty-state">No matching record found for this section and key.</p>
      </section>
    );
  }

  if (target.type === "node") {
    const { node, edges } = target;
    const fileTargets = getFileTargets(section, { id: node.id });

    return (
      <div className="content-stack">
        <section className="panel panel-accent">
          <h2>Graph Node Detail</h2>
          <p>{node.label}</p>
          <p className="empty-state">{node.type} · {node.id}</p>
          <div className="header-actions" style={{ marginTop: 10 }}>
            {fileTargets.map((fileTarget) => (
              <a key={fileTarget.label} className="header-action-link" href={fileTarget.href} target="_blank" rel="noreferrer">
                <IconFile size={13} />
                <span>{fileTarget.label}</span>
                <IconExternal size={12} />
              </a>
            ))}
            <a className="header-action-link" href="/api/fs/list?scope=snapshot" target="_blank" rel="noreferrer">
              <IconFile size={13} />
              <span>Browse Snapshot Tree</span>
              <IconExternal size={12} />
            </a>
          </div>
        </section>

        <section className="panel">
          <h3>Connected Edges ({edges.length})</h3>
          <ul className="edge-list">
            {edges.map((edge) => (
              <li key={`${edge.source}-${edge.target}-${edge.label}`}>
                <code>{edge.source}</code>
                <span>{edge.label}</span>
                <code>{edge.target}</code>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  const { row: targetRow } = target;
  const fileTargets = getFileTargets(section, targetRow);

  return (
    <div className="content-stack">
      <section className="panel panel-accent">
        <h2>{prettyLabel(section)} Detail</h2>
        <p>{getPrimaryKey(targetRow)}</p>
        <div className="header-actions" style={{ marginTop: 10 }}>
          {fileTargets.map((fileTarget) => (
            <a key={fileTarget.label} className="header-action-link" href={fileTarget.href} target="_blank" rel="noreferrer">
              <IconFile size={13} />
              <span>{fileTarget.label}</span>
              <IconExternal size={12} />
            </a>
          ))}
          <a className="header-action-link" href="/api/fs/list?scope=snapshot" target="_blank" rel="noreferrer">
            <IconFile size={13} />
            <span>Browse Snapshot Tree</span>
            <IconExternal size={12} />
          </a>
        </div>
      </section>

      <section className="panel">
        <div className="detail-grid">
          {Object.entries(targetRow).map(([field, value]) => (
            <article key={field} className={`detail-card ${isWideField(field, value) ? "wide" : ""}`}>
              <h4>{prettyLabel(field)}</h4>
              <div className="detail-value">
                <ValueRenderer value={value} field={field} format="auto" />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
