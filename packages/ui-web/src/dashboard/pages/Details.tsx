import React from "react";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Tooltip } from "../components/Tooltip";
import { IconExternal, IconFile } from "../components/Icons";
import { getSectionIcon } from "../lib/section-icons";
import { ValueRenderer } from "../components/ValueRenderer";
import { findDetailTarget, getPrimaryKey, prettyLabel, type CategoryMap, type GraphEdge } from "../lib/model";
import type { DashboardSectionDef } from "@sbtools/sdk";

interface DetailsPageProps {
  categories: CategoryMap;
  search: URLSearchParams;
  sections?: DashboardSectionDef[];
  onOpenDetail?: (section: string, key: string) => void;
}

function EdgeTable({
  edges,
  currentId,
  direction,
  onOpenDetail,
}: {
  edges: GraphEdge[];
  currentId: string;
  direction: "inbound" | "outbound";
  onOpenDetail?: (section: string, key: string) => void;
}) {
  if (edges.length === 0) {
    return <p className="empty-state">No {direction} dependencies.</p>;
  }
  const section = "dependency_graph";
  return (
    <div className="table-surface">
      <table className="table-grid">
        <thead>
          <tr>
            <th>{direction === "inbound" ? "Source" : "Target"}</th>
            <th>Relationship</th>
          </tr>
        </thead>
        <tbody>
          {edges.map((edge) => {
            const otherId = direction === "inbound" ? edge.source : edge.target;
            return (
              <tr key={`${edge.source}-${edge.target}-${edge.label}`}>
                <td>
                  {onOpenDetail ? (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => onOpenDetail(section, otherId)}
                    >
                      <code>{otherId}</code>
                    </button>
                  ) : (
                    <code>{otherId}</code>
                  )}
                </td>
                <td>
                  <Tooltip content={`Relationship: ${edge.label}`}>
                    <span><Badge>{edge.label}</Badge></span>
                  </Tooltip>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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

export function DetailsPage({ categories, search, sections = [], onOpenDetail }: DetailsPageProps) {
  const section = search.get("section") ?? "";
  const key = search.get("key") ?? "";
  const target = findDetailTarget(categories, section, key, sections);

  if (!target) {
    return (
      <section className="panel">
        <EmptyState
          title="Detail Not Found"
          message="No matching record found for this section and key."
          iconType="alert"
        />
      </section>
    );
  }

  if (target.type === "node") {
    const { node, edges } = target;
    const fileTargets = getFileTargets(section, { id: node.id });
    const schema = node.id.includes(".") ? node.id.split(".").slice(0, -1).join(".") : "";
    const inboundEdges = edges.filter((e) => e.target === node.id);
    const outboundEdges = edges.filter((e) => e.source === node.id);

    return (
      <div className="content-stack">
        <section className="panel panel-accent">
          <div className="detail-header" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>{node.label}</h2>
            <Tooltip content={`Node type: ${node.type}`}>
              <span><Badge tone="accent">{node.type}</Badge></span>
            </Tooltip>
          </div>
          <div className="detail-grid" style={{ marginBottom: 16 }}>
            <article className="detail-card">
              <h4>Type</h4>
              <div className="detail-value">
                <Tooltip content={`Entity type: ${node.type}`}>
                  <span><Badge tone="accent">{node.type}</Badge></span>
                </Tooltip>
              </div>
            </article>
            {schema ? (
              <article className="detail-card">
                <h4>Schema</h4>
                <div className="detail-value">{schema}</div>
              </article>
            ) : null}
            <article className="detail-card">
              <h4>ID</h4>
              <div className="detail-value"><code className="code-inline">{node.id}</code></div>
            </article>
            <article className="detail-card">
              <h4>Inbound</h4>
              <div className="detail-value">
                <Tooltip content="Number of dependencies targeting this node">
                  <span><Badge tone="default">{inboundEdges.length}</Badge></span>
                </Tooltip>
              </div>
            </article>
            <article className="detail-card">
              <h4>Outbound</h4>
              <div className="detail-value">
                <Tooltip content="Number of dependencies this node references">
                  <span><Badge tone="default">{outboundEdges.length}</Badge></span>
                </Tooltip>
              </div>
            </article>
            <article className="detail-card">
              <h4>Total Connections</h4>
              <div className="detail-value">
                <Tooltip content="Total edges connected to this node">
                  <span><Badge tone="accent">{edges.length}</Badge></span>
                </Tooltip>
              </div>
            </article>
          </div>
          <div className="header-actions">
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
          <h3>Inbound Dependencies ({inboundEdges.length})</h3>
          <EdgeTable edges={inboundEdges} currentId={node.id} direction="inbound" onOpenDetail={onOpenDetail} />
        </section>

        <section className="panel">
          <h3>Outbound Dependencies ({outboundEdges.length})</h3>
          <EdgeTable edges={outboundEdges} currentId={node.id} direction="outbound" onOpenDetail={onOpenDetail} />
        </section>
      </div>
    );
  }

  const { row: targetRow } = target;
  const fileTargets = getFileTargets(section, targetRow);

  return (
    <div className="content-stack">
      <section className="panel panel-accent">
        <div className="detail-header">
          {React.createElement(getSectionIcon(section), { size: 20, className: "detail-type-icon" })}
          <div>
            <h2>{prettyLabel(section)} Detail</h2>
            <p>{getPrimaryKey(targetRow)}</p>
          </div>
        </div>
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
