import type { DashboardSectionDef } from "@sbtools/sdk";

export type AtlasRow = Record<string, unknown>;
export type CategoryMap = Record<string, unknown[]>;

export type RouteName = "overview" | "migrations" | "depgraph" | "logs" | "frontend" | "details";

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  section: string;
  keyField: string;
}

export interface NavItem {
  route: RouteName;
  path: string;
  label: string;
  subtitle: string;
  enabled: boolean;
  icon: "home" | "migrations" | "graph" | "logs" | "frontend";
}

export interface PluginAvailability {
  migrations: boolean;
  depgraph: boolean;
  logs: boolean;
  frontend: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export const DARK_STORAGE_KEY = "sbt-dashboard-dark";
export const STUDIO_URL_STORAGE_KEY = "sbt-dashboard-studio-url";
export const DEFAULT_STUDIO_URL = "http://localhost:3335";

const ROUTE_PREFIXES: Array<{ route: RouteName; prefix: string }> = [
  { route: "migrations", prefix: "/migrations" },
  { route: "depgraph", prefix: "/depgraph" },
  { route: "logs", prefix: "/logs" },
  { route: "frontend", prefix: "/frontend-usage" },
  { route: "details", prefix: "/details" },
];

function hasSection(sections: DashboardSectionDef[], predicate: (section: DashboardSectionDef) => boolean): boolean {
  return sections.some(predicate);
}

export function inferPluginAvailability(categories: CategoryMap, sections: DashboardSectionDef[]): PluginAvailability {
  return {
    migrations:
      Boolean(categories.migration_audit?.length) ||
      hasSection(sections, (section) => section.dataKey === "migration_audit" || section.id.includes("migration")),
    depgraph:
      Boolean(categories.dependency_graph?.length) ||
      hasSection(sections, (section) => section.dataKey === "dependency_graph" || section.id.includes("depgraph")),
    logs: true,
    frontend:
      Boolean(categories.frontend_usage?.length) ||
      hasSection(sections, (section) => section.dataKey === "frontend_usage" || section.id.includes("frontend")),
  };
}

export function getNavItems(availability: PluginAvailability): NavItem[] {
  return [
    { route: "overview", path: "/", label: "Overview", subtitle: "Schema and runtime inventory", enabled: true, icon: "home" },
    {
      route: "migrations",
      path: "/migrations",
      label: "Migrations",
      subtitle: "Audit, drift, and apply flow",
      enabled: availability.migrations,
      icon: "migrations",
    },
    {
      route: "depgraph",
      path: "/depgraph",
      label: "Dependencies",
      subtitle: "Graph of object relationships",
      enabled: availability.depgraph,
      icon: "graph",
    },
    {
      route: "logs",
      path: "/logs",
      label: "Logs & Performance",
      subtitle: "Query and service health",
      enabled: availability.logs,
      icon: "logs",
    },
    {
      route: "frontend",
      path: "/frontend-usage",
      label: "Frontend Usage",
      subtitle: "Component resource footprint",
      enabled: availability.frontend,
      icon: "frontend",
    },
  ];
}

export function isRecord(value: unknown): value is AtlasRow {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function toRows(items: unknown[]): AtlasRow[] {
  return items.filter(isRecord);
}

export function normalizePath(pathname: string): RouteName {
  for (const route of ROUTE_PREFIXES) {
    if (pathname.startsWith(route.prefix)) return route.route;
  }
  return "overview";
}

export function prettyLabel(input: string): string {
  return input
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "-";
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return value;
  return ts.toLocaleString();
}

export function formatValue(value: unknown): string {
  if (value == null) return "-";
  if (Array.isArray(value)) return value.map((entry) => formatValue(entry)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : String(value);
  return String(value);
}

export function getPrimaryKey(item: AtlasRow): string {
  const candidates = ["id", "name", "filename", "component", "service", "source_id", "target_id", "signature", "query"];
  for (const key of candidates) {
    if (item[key] != null) return String(item[key]);
  }
  return JSON.stringify(item).slice(0, 64);
}

export function buildSearchIndex(categories: CategoryMap): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const [section, value] of Object.entries(categories)) {
    for (const row of toRows(value)) {
      if (section === "migration_audit" && typeof row.total === "number") continue;
      const keyField = getPrimaryKey(row);
      const title =
        String(row.name ?? row.filename ?? row.component ?? row.service ?? row.source_label ?? row.query ?? keyField);
      const subtitle =
        String(
          row.schema ?? row.signature ?? row.status ?? row.table ?? row.endpoint ?? row.target_label ?? row.container ?? ""
        );
      hits.push({ id: `${section}:${keyField}`, title, subtitle, section, keyField });
    }
  }
  return hits;
}

export function readStudioUrl(): string {
  if (typeof window === "undefined") return DEFAULT_STUDIO_URL;
  const value = localStorage.getItem(STUDIO_URL_STORAGE_KEY);
  return value?.trim() ? value : DEFAULT_STUDIO_URL;
}

export function getInitialDark(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(DARK_STORAGE_KEY);
  if (stored !== null) return stored === "1";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function buildGraphModel(categoryRows: unknown[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const records = toRows(categoryRows);
  const summary = records[0];
  if (!summary) return { nodes: [], edges: [] };

  const edgeRows = Array.isArray(summary.edges) ? summary.edges.filter(isRecord) : [];
  const nodeMap = new Map<string, { label: string; type: string }>();
  const edges: GraphEdge[] = [];

  for (const edgeRow of edgeRows) {
    const source = String(edgeRow.source_id ?? "");
    const target = String(edgeRow.target_id ?? "");
    if (!source || !target) continue;

    nodeMap.set(source, {
      label: String(edgeRow.source_label ?? source),
      type: String(edgeRow.source_type ?? "object"),
    });
    nodeMap.set(target, {
      label: String(edgeRow.target_label ?? target),
      type: String(edgeRow.target_type ?? "object"),
    });
    edges.push({ source, target, label: String(edgeRow.label ?? "related") });
  }

  const types = Array.from(new Set(Array.from(nodeMap.values()).map((node) => node.type))).sort();
  const byType = new Map<string, string[]>();
  for (const [id, node] of nodeMap.entries()) {
    const bucket = byType.get(node.type) ?? [];
    bucket.push(id);
    byType.set(node.type, bucket);
  }

  const colWidth = 260;
  const rowHeight = 86;
  const nodes: GraphNode[] = [];

  types.forEach((type, col) => {
    const ids = (byType.get(type) ?? []).sort();
    ids.forEach((id, row) => {
      const node = nodeMap.get(id);
      if (!node) return;
      nodes.push({
        id,
        label: node.label,
        type: node.type,
        x: 160 + col * colWidth,
        y: 80 + row * rowHeight,
      });
    });
  });

  return { nodes, edges };
}
