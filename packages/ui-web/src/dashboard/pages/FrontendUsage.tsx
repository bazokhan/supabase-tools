import React from "react";
import { AppDataTable, type ColumnMeta } from "../components/AppDataTable";
import { ComponentsCell } from "../components/ComponentsCell";
import { EmptyPanel } from "../components/EmptyPanel";
import { MiniBarChart } from "../components/MiniBarChart";
import { toRows } from "../lib/model";
import type { PageProps } from "./page-types";
import type { AtlasRow } from "../lib/model";

const FRONTEND_COLUMN_META: Record<string, ColumnMeta> = {
  component: {
    label: "Component",
    tooltip: "Frontend file or component that uses Supabase SDK (e.g. .from(), .rpc(), auth, storage).",
  },
  score: {
    label: "Hotness",
    tooltip: "Combined score (hits + resource types × 3 + resources × 2). Higher = more coupling to backend.",
  },
  hitCount: {
    label: "Hits",
    tooltip: "Number of SDK usage instances detected in this component (e.g. .from(\"table\") or .rpc(\"fn\")).",
  },
  typeCount: {
    label: "Resource Types",
    tooltip: "Count of distinct resource types used: table, rpc, auth, storage, edge_function, rest_api.",
  },
  resourceCount: {
    label: "Resources",
    tooltip: "Count of distinct backend resources used (tables, RPCs, storage buckets, etc.).",
  },
  resources: {
    label: "Backend Resources",
    tooltip: "Backend resources used by this component. Type + name (e.g. table: papers, rpc: get_stats).",
  },
  resource: {
    label: "Resource",
    tooltip: "Backend resource identifier: table name, RPC name, storage bucket, etc.",
  },
  type: {
    label: "Type",
    tooltip: "Resource type: table, rpc, auth, storage, edge_function, rest_api.",
  },
  componentCount: {
    label: "Components",
    tooltip: "Number of frontend components that use this backend resource.",
  },
  hitCountSum: {
    label: "Total Hits",
    tooltip: "Sum of SDK hits across all components that use this resource.",
  },
  components: {
    label: "Used By",
    tooltip: "Frontend components that call this backend resource. Click to view all and copy paths.",
    renderCell: (value, row: AtlasRow) => {
      const list = Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
      const resourceLabel =
        row.type != null && row.resource != null
          ? `${row.type}: ${row.resource}`
          : undefined;
      return <ComponentsCell components={list} resourceLabel={resourceLabel} />;
    },
  },
};

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
  const [selectedTypes, setSelectedTypes] = React.useState<string[]>([]);
  const [activeView, setActiveView] = React.useState<"hot" | "components" | "resources">("hot");
  const rows = toRows(categories.frontend_usage ?? []);

  const allTypes = React.useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const resources = Array.isArray(row.resources) ? row.resources : [];
      for (const resource of resources) {
        if (resource && typeof resource === "object" && "type" in resource) {
          const type = String((resource as { type: string }).type ?? "");
          if (type) set.add(type);
        }
      }
    }
    return Array.from(set).sort();
  }, [rows]);

  React.useEffect(() => {
    if (allTypes.length === 0) {
      if (selectedTypes.length > 0) setSelectedTypes([]);
      return;
    }
    if (selectedTypes.length === 0) {
      setSelectedTypes(allTypes);
      return;
    }
    const next = selectedTypes.filter((t) => allTypes.includes(t));
    if (next.length === 0) {
      setSelectedTypes(allTypes);
      return;
    }
    if (next.length !== selectedTypes.length) setSelectedTypes(next);
  }, [allTypes, selectedTypes]);

  const selectedTypeSet = new Set(selectedTypes);

  const componentRows = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows
      .map((row) => {
        const component = String(row.component ?? "");
        const hitCount = Number(row.hitCount ?? 0);
        const resourcesRaw = Array.isArray(row.resources) ? row.resources : [];
        const resources = resourcesRaw
          .filter((r) => r && typeof r === "object" && "type" in r && "resource" in r)
          .map((r) => ({
            type: String((r as { type: string }).type ?? ""),
            resource: String((r as { resource: string }).resource ?? ""),
          }))
          .filter((r) => r.type && r.resource);

        const typeFilteredResources =
          selectedTypes.length === 0 ? resources : resources.filter((r) => selectedTypeSet.has(r.type));
        const resourceText = typeFilteredResources.map((r) => `${r.type} ${r.resource}`).join(" ").toLowerCase();
        const matches = !term || `${component} ${resourceText}`.toLowerCase().includes(term);
        return {
          component,
          hitCount,
          resources: typeFilteredResources,
          resourceCount: typeFilteredResources.length,
          typeCount: new Set(typeFilteredResources.map((r) => r.type)).size,
          matches,
        };
      })
      .filter((row) => row.resources.length > 0 && row.matches);
  }, [query, rows, selectedTypeSet, selectedTypes.length]);

  const resourceRows = React.useMemo(() => {
    const byResource = new Map<string, { type: string; resource: string; components: Set<string>; hitCountSum: number }>();
    for (const row of componentRows) {
      for (const resource of row.resources) {
        const key = `${resource.type}:${resource.resource}`;
        const current = byResource.get(key) ?? {
          type: resource.type,
          resource: resource.resource,
          components: new Set<string>(),
          hitCountSum: 0,
        };
        current.components.add(row.component);
        current.hitCountSum += row.hitCount;
        byResource.set(key, current);
      }
    }
    return Array.from(byResource.values()).map((entry) => ({
      type: entry.type,
      resource: entry.resource,
      componentCount: entry.components.size,
      components: Array.from(entry.components).sort(),
      hitCountSum: entry.hitCountSum,
    }));
  }, [componentRows]);

  const hotComponents = React.useMemo(() => {
    return [...componentRows]
      .map((row) => ({
        component: row.component,
        score: Math.round(row.hitCount + row.typeCount * 3 + row.resourceCount * 2),
        hitCount: row.hitCount,
        typeCount: row.typeCount,
        resourceCount: row.resourceCount,
      }))
      .sort((a, b) => b.score - a.score || b.hitCount - a.hitCount || a.component.localeCompare(b.component));
  }, [componentRows]);

  const hotBarData = hotComponents.slice(0, 8).map((row) => ({
    label: row.component,
    value: row.score,
    tone: row.score >= 18 ? "bad" : row.score >= 10 ? "warn" : "accent",
  }));

  function toggleType(type: string) {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type],
    );
  }

  return (
    <div className="content-stack">
      <section className="panel panel-accent">
        <div className="panel-head">
          <input
            type="search"
            className="ui-input"
            placeholder="Search by component or resource"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="tab-row">
          <button type="button" className="tab-btn" onClick={() => setSelectedTypes(allTypes)}>
            All Types
          </button>
          {allTypes.map((type) => (
            <button
              key={type}
              type="button"
              className={`tab-btn ${selectedTypeSet.has(type) ? "active" : ""}`}
              onClick={() => toggleType(type)}
            >
              {type}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="tab-row">
          <button type="button" className={`tab-btn ${activeView === "hot" ? "active" : ""}`} onClick={() => setActiveView("hot")}>
            Hot Components
          </button>
          <button
            type="button"
            className={`tab-btn ${activeView === "components" ? "active" : ""}`}
            onClick={() => setActiveView("components")}
          >
            Component Map
          </button>
          <button
            type="button"
            className={`tab-btn ${activeView === "resources" ? "active" : ""}`}
            onClick={() => setActiveView("resources")}
          >
            Resource Impact
          </button>
        </div>

        {activeView === "hot" ? (
          <>
            <div className="panel-head">
              <div>
                <h3>Hot Components</h3>
                <p>Components ranked by coupling to backend (SDK calls). Hover column headers for metric details.</p>
              </div>
            </div>
            <MiniBarChart data={hotBarData} yAxisWidth={176} />
            <AppDataTable
              rows={toRows(hotComponents as unknown[])}
              columns={["component", "score", "hitCount", "typeCount", "resourceCount"]}
              columnMeta={FRONTEND_COLUMN_META}
              onRowClick={(row) => onOpenDetail("frontend_usage", String(row.component ?? ""))}
              pageSize={12}
            />
          </>
        ) : null}

        {activeView === "components" ? (
          <>
            <div className="panel-head">
              <div>
                <h3>Component to Resource Map</h3>
                <p>Component-centric usage with current filters applied.</p>
              </div>
            </div>
            <AppDataTable
              rows={toRows(componentRows as unknown[])}
              columns={["component", "hitCount", "resources"]}
              columnMeta={FRONTEND_COLUMN_META}
              onRowClick={(row) => onOpenDetail("frontend_usage", String(row.component ?? ""))}
            />
          </>
        ) : null}

        {activeView === "resources" ? (
          <>
            <div className="panel-head">
              <div>
                <h3>Resource Impact Map</h3>
                <p>Resource-centric view to answer who is coupled to each backend resource.</p>
              </div>
            </div>
            <AppDataTable
              rows={toRows(resourceRows as unknown[])}
              columns={["resource", "type", "componentCount", "hitCountSum", "components"]}
              columnMeta={FRONTEND_COLUMN_META}
              pageSize={30}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}
