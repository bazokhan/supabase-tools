import React from "react";
import { EmptyPanel } from "../components/EmptyPanel";
import { getNodeTypeIcon } from "../lib/section-icons";
import { buildGraphModel, type GraphNode } from "../lib/model";
import type { PageProps } from "./page-types";

interface DependenciesPageProps extends PageProps {
  enabled: boolean;
}

const MAX_RENDER_EDGES = 650;
const FOCUS_DEPTH_VALUES = [0, 1, 2, 3, 4] as const;
const RELAYOUT_COL_WIDTH = 220;
const RELAYOUT_ROW_HEIGHT = 76;
const RELAYOUT_START_X = 140;
const RELAYOUT_START_Y = 72;

type DegreeFilter = "all" | "0" | "1" | "3" | "5" | "10";
type PaletteId = "default" | "colorblind" | "highContrast" | "muted";

interface TypeVisual {
  fill: string;
  stroke: string;
  text: string;
  subtitle: string;
  edge: string;
  activeStroke: string;
}

const PALETTES: Record<PaletteId, { label: string; colors: Record<string, TypeVisual>; fallback: TypeVisual }> = {
  default: {
    label: "Default",
    colors: {
      table: { fill: "#dbeafe", stroke: "#2563eb", text: "#1e3a8a", subtitle: "#1e40af", edge: "#3b82f6", activeStroke: "#1d4ed8" },
      function: { fill: "#dcfce7", stroke: "#16a34a", text: "#14532d", subtitle: "#166534", edge: "#22c55e", activeStroke: "#15803d" },
      trigger: { fill: "#ffedd5", stroke: "#ea580c", text: "#7c2d12", subtitle: "#9a3412", edge: "#f97316", activeStroke: "#c2410c" },
      policy: { fill: "#f3e8ff", stroke: "#9333ea", text: "#581c87", subtitle: "#6b21a8", edge: "#a855f7", activeStroke: "#7e22ce" },
      view: { fill: "#ccfbf1", stroke: "#0d9488", text: "#134e4a", subtitle: "#115e59", edge: "#14b8a6", activeStroke: "#0f766e" },
      materialized_view: { fill: "#ccfbf1", stroke: "#0d9488", text: "#134e4a", subtitle: "#115e59", edge: "#14b8a6", activeStroke: "#0f766e" },
      enum: { fill: "#fce7f3", stroke: "#db2777", text: "#831843", subtitle: "#9d174d", edge: "#ec4899", activeStroke: "#be185d" },
      type: { fill: "#fef3c7", stroke: "#d97706", text: "#78350f", subtitle: "#92400e", edge: "#f59e0b", activeStroke: "#b45309" },
      object: { fill: "#e2e8f0", stroke: "#64748b", text: "#1e293b", subtitle: "#334155", edge: "#94a3b8", activeStroke: "#475569" },
    },
    fallback: { fill: "#e2e8f0", stroke: "#64748b", text: "#1e293b", subtitle: "#334155", edge: "#94a3b8", activeStroke: "#475569" },
  },
  colorblind: {
    label: "Colorblind-safe",
    colors: {
      table: { fill: "#eaf2ff", stroke: "#3b5dc9", text: "#1f2a5f", subtitle: "#2f3b79", edge: "#4f6edb", activeStroke: "#2f4fb7" },
      function: { fill: "#eef8ec", stroke: "#3d8a4a", text: "#1f4f2a", subtitle: "#2f6c39", edge: "#52a862", activeStroke: "#2d733b" },
      trigger: { fill: "#fff2e8", stroke: "#c56f2d", text: "#6d3b16", subtitle: "#8a4d1f", edge: "#d98443", activeStroke: "#a85c24" },
      policy: { fill: "#f4efff", stroke: "#6c57c3", text: "#3a2b73", subtitle: "#4a398f", edge: "#8570d6", activeStroke: "#5a46ac" },
      view: { fill: "#e8f7fb", stroke: "#2f7f93", text: "#184857", subtitle: "#225f74", edge: "#3f97ad", activeStroke: "#286d7e" },
      materialized_view: { fill: "#e8f7fb", stroke: "#2f7f93", text: "#184857", subtitle: "#225f74", edge: "#3f97ad", activeStroke: "#286d7e" },
      enum: { fill: "#fbeaf1", stroke: "#b7477f", text: "#6b2044", subtitle: "#822b55", edge: "#ca5f93", activeStroke: "#9d3b6d" },
      type: { fill: "#fff6df", stroke: "#b68a2f", text: "#624b17", subtitle: "#7a5e21", edge: "#caa145", activeStroke: "#9f7927" },
      object: { fill: "#edf1f5", stroke: "#5f7388", text: "#223344", subtitle: "#33485e", edge: "#7a90a6", activeStroke: "#4c6073" },
    },
    fallback: { fill: "#edf1f5", stroke: "#5f7388", text: "#223344", subtitle: "#33485e", edge: "#7a90a6", activeStroke: "#4c6073" },
  },
  highContrast: {
    label: "High contrast",
    colors: {
      table: { fill: "#eff6ff", stroke: "#1d4ed8", text: "#0f172a", subtitle: "#1e293b", edge: "#1d4ed8", activeStroke: "#1e40af" },
      function: { fill: "#f0fdf4", stroke: "#15803d", text: "#0f172a", subtitle: "#1f2937", edge: "#15803d", activeStroke: "#166534" },
      trigger: { fill: "#fff7ed", stroke: "#c2410c", text: "#0f172a", subtitle: "#1f2937", edge: "#ea580c", activeStroke: "#9a3412" },
      policy: { fill: "#faf5ff", stroke: "#7e22ce", text: "#0f172a", subtitle: "#1f2937", edge: "#9333ea", activeStroke: "#6b21a8" },
      view: { fill: "#ecfeff", stroke: "#0f766e", text: "#0f172a", subtitle: "#1f2937", edge: "#0d9488", activeStroke: "#115e59" },
      materialized_view: { fill: "#ecfeff", stroke: "#0f766e", text: "#0f172a", subtitle: "#1f2937", edge: "#0d9488", activeStroke: "#115e59" },
      enum: { fill: "#fdf2f8", stroke: "#be185d", text: "#0f172a", subtitle: "#1f2937", edge: "#db2777", activeStroke: "#9d174d" },
      type: { fill: "#fffbeb", stroke: "#b45309", text: "#0f172a", subtitle: "#1f2937", edge: "#d97706", activeStroke: "#92400e" },
      object: { fill: "#f1f5f9", stroke: "#334155", text: "#0f172a", subtitle: "#1f2937", edge: "#475569", activeStroke: "#1e293b" },
    },
    fallback: { fill: "#f1f5f9", stroke: "#334155", text: "#0f172a", subtitle: "#1f2937", edge: "#475569", activeStroke: "#1e293b" },
  },
  muted: {
    label: "Muted",
    colors: {
      table: { fill: "#eaf1f8", stroke: "#5f7ea0", text: "#2b3a4a", subtitle: "#3d5166", edge: "#6f8fb1", activeStroke: "#4f6e90" },
      function: { fill: "#ecf5ef", stroke: "#648f73", text: "#294534", subtitle: "#3c5e4a", edge: "#78a286", activeStroke: "#537a62" },
      trigger: { fill: "#f8f1eb", stroke: "#a57a5d", text: "#4b3628", subtitle: "#674b39", edge: "#b58b6f", activeStroke: "#8d654c" },
      policy: { fill: "#f2edf8", stroke: "#7f6a9f", text: "#3e3057", subtitle: "#58477b", edge: "#927db1", activeStroke: "#6d5a8b" },
      view: { fill: "#eaf5f4", stroke: "#5f8f89", text: "#284642", subtitle: "#3a625c", edge: "#71a39c", activeStroke: "#4d7a74" },
      materialized_view: { fill: "#eaf5f4", stroke: "#5f8f89", text: "#284642", subtitle: "#3a625c", edge: "#71a39c", activeStroke: "#4d7a74" },
      enum: { fill: "#f7edf3", stroke: "#9a6784", text: "#533043", subtitle: "#6d4460", edge: "#ad7896", activeStroke: "#83576f" },
      type: { fill: "#f8f4e8", stroke: "#a28a58", text: "#4f4225", subtitle: "#695934", edge: "#b59d6e", activeStroke: "#8a7448" },
      object: { fill: "#eef1f4", stroke: "#72808f", text: "#2c3946", subtitle: "#3e4e5f", edge: "#8795a4", activeStroke: "#5f6c7a" },
    },
    fallback: { fill: "#eef1f4", stroke: "#72808f", text: "#2c3946", subtitle: "#3e4e5f", edge: "#8795a4", activeStroke: "#5f6c7a" },
  },
};

function getTypeVisual(paletteId: PaletteId, type: string): TypeVisual {
  const palette = PALETTES[paletteId];
  return palette.colors[type] ?? palette.fallback;
}

function degreePassesFilter(degree: number, filter: DegreeFilter): boolean {
  switch (filter) {
    case "0":
      return degree === 0;
    case "1":
      return degree >= 1;
    case "3":
      return degree >= 3;
    case "5":
      return degree >= 5;
    case "10":
      return degree >= 10;
    default:
      return true;
  }
}

export function DependenciesPage({ categories, onOpenDetail, enabled }: DependenciesPageProps) {
  if (!enabled) {
    return (
      <EmptyPanel
        title="Dependency Graph Plugin Not Active"
        message="No dependency graph section is currently registered in this dashboard."
        hint="Enable @sbtools/plugin-depgraph, run sbt depgraph or sbt generate-atlas, then refresh."
      />
    );
  }
  return <DependenciesEnabled categories={categories} onOpenDetail={onOpenDetail} />;
}

function DependenciesEnabled({ categories, onOpenDetail }: PageProps) {
  const [search, setSearch] = React.useState("");
  const [selectedNode, setSelectedNode] = React.useState("");
  const [focusEnabled, setFocusEnabled] = React.useState(false);
  const [focusDepth, setFocusDepth] = React.useState<number>(1);
  const [paletteId, setPaletteId] = React.useState<PaletteId>("default");
  const [selectedTypes, setSelectedTypes] = React.useState<string[]>([]);
  const [orphansOnly, setOrphansOnly] = React.useState(false);
  const [degreeFilter, setDegreeFilter] = React.useState<DegreeFilter>("all");
  const [zoom, setZoom] = React.useState(0.65);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const initializedSelectionRef = React.useRef(false);
  const panStartRef = React.useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);
  const model = React.useMemo(() => buildGraphModel(categories.dependency_graph ?? []), [categories.dependency_graph]);
  const nodesById = React.useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model.nodes]);
  const nodeTypes = React.useMemo(() => Array.from(new Set(model.nodes.map((node) => node.type))).sort(), [model.nodes]);

  React.useEffect(() => {
    if (model.nodes.length === 0) {
      if (selectedNode) setSelectedNode("");
      initializedSelectionRef.current = false;
      return;
    }
    if (selectedNode && !nodesById.has(selectedNode)) {
      setSelectedNode("");
      return;
    }
    if (!initializedSelectionRef.current && !selectedNode) {
      setSelectedNode(model.nodes[0].id);
      initializedSelectionRef.current = true;
    }
  }, [model.nodes, nodesById, selectedNode]);

  React.useEffect(() => {
    if (nodeTypes.length === 0) {
      if (selectedTypes.length > 0) setSelectedTypes([]);
      return;
    }
    if (selectedTypes.length === 0) {
      setSelectedTypes(nodeTypes);
      return;
    }
    const next = selectedTypes.filter((type) => nodeTypes.includes(type));
    if (next.length === 0) {
      setSelectedTypes(nodeTypes);
      return;
    }
    if (next.length !== selectedTypes.length) {
      setSelectedTypes(next);
    }
  }, [nodeTypes, selectedTypes]);

  const graphMeta = React.useMemo(() => {
    const neighbors = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();
    const totalDegree = new Map<string, number>();

    for (const node of model.nodes) {
      neighbors.set(node.id, new Set<string>());
      inDegree.set(node.id, 0);
      outDegree.set(node.id, 0);
      totalDegree.set(node.id, 0);
    }

    for (const edge of model.edges) {
      if (!neighbors.has(edge.source)) neighbors.set(edge.source, new Set<string>());
      if (!neighbors.has(edge.target)) neighbors.set(edge.target, new Set<string>());
      neighbors.get(edge.source)?.add(edge.target);
      neighbors.get(edge.target)?.add(edge.source);
      outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
      totalDegree.set(edge.source, (totalDegree.get(edge.source) ?? 0) + 1);
      totalDegree.set(edge.target, (totalDegree.get(edge.target) ?? 0) + 1);
    }

    return { neighbors, inDegree, outDegree, totalDegree };
  }, [model.edges, model.nodes]);

  const baseNodes = React.useMemo(() => {
    const allowedTypes = new Set(selectedTypes);
    const term = search.trim().toLowerCase();
    return model.nodes.filter((node) => {
      if (selectedTypes.length > 0 && !allowedTypes.has(node.type)) return false;
      if (term && !`${node.id} ${node.label} ${node.type} ${node.schema}`.toLowerCase().includes(term)) return false;
      const degree = graphMeta.totalDegree.get(node.id) ?? 0;
      if (orphansOnly && degree !== 0) return false;
      return degreePassesFilter(degree, degreeFilter);
    });
  }, [degreeFilter, graphMeta.totalDegree, model.nodes, orphansOnly, search, selectedTypes]);

  const focusedNodeSet = React.useMemo(() => {
    if (!focusEnabled || !selectedNode || !nodesById.has(selectedNode)) return null;
    const visited = new Set<string>([selectedNode]);
    const queue: Array<{ id: string; depth: number }> = [{ id: selectedNode, depth: 0 }];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      if (current.depth >= focusDepth) continue;
      for (const next of graphMeta.neighbors.get(current.id) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push({ id: next, depth: current.depth + 1 });
      }
    }
    return visited;
  }, [focusDepth, focusEnabled, graphMeta.neighbors, nodesById, selectedNode]);

  const renderNodes = React.useMemo(() => {
    if (!focusedNodeSet) return baseNodes;
    const baseIds = new Set(baseNodes.map((node) => node.id));
    const nodes = model.nodes.filter((node) => focusedNodeSet.has(node.id) && baseIds.has(node.id));
    if (selectedNode) {
      const selected = nodesById.get(selectedNode);
      if (selected && !nodes.some((node) => node.id === selected.id)) {
        nodes.push(selected);
      }
    }
    return nodes;
  }, [baseNodes, focusedNodeSet, model.nodes, nodesById, selectedNode]);

  const renderNodesRelayout = React.useMemo(() => {
    if (renderNodes.length === 0) return [];
    const byType = new Map<string, GraphNode[]>();
    for (const node of renderNodes) {
      const bucket = byType.get(node.type) ?? [];
      bucket.push(node);
      byType.set(node.type, bucket);
    }

    const orderedTypes = Array.from(byType.keys()).sort();
    const laidOut: GraphNode[] = [];
    orderedTypes.forEach((type, colIndex) => {
      const nodes = (byType.get(type) ?? []).slice().sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
      nodes.forEach((node, rowIndex) => {
        laidOut.push({
          ...node,
          x: RELAYOUT_START_X + colIndex * RELAYOUT_COL_WIDTH,
          y: RELAYOUT_START_Y + rowIndex * RELAYOUT_ROW_HEIGHT,
        });
      });
    });
    return laidOut;
  }, [renderNodes]);

  const renderNodesById = React.useMemo(
    () => new Map(renderNodesRelayout.map((node) => [node.id, node])),
    [renderNodesRelayout],
  );
  const renderIdSet = React.useMemo(() => new Set(renderNodesRelayout.map((node) => node.id)), [renderNodesRelayout]);

  const renderEdgesMeta = React.useMemo(() => {
    const allVisible = model.edges.filter((edge) => renderIdSet.has(edge.source) && renderIdSet.has(edge.target));
    return {
      edges: allVisible.slice(0, MAX_RENDER_EDGES),
      hiddenCount: Math.max(0, allVisible.length - MAX_RENDER_EDGES),
      totalVisible: allVisible.length,
    };
  }, [model.edges, renderIdSet]);

  const connectedEdges = React.useMemo(() => {
    if (!selectedNode) return [];
    return model.edges.filter((edge) => edge.source === selectedNode || edge.target === selectedNode);
  }, [model.edges, selectedNode]);
  const showEdgeLabels = focusEnabled || renderEdgesMeta.edges.length <= 80;
  const selectedNodeData = selectedNode ? nodesById.get(selectedNode) : undefined;
  const selectedNodeVisual = getTypeVisual(paletteId, selectedNodeData?.type ?? "object");

  const width = Math.max(860, ...renderNodesRelayout.map((node) => node.x + 140));
  const height = Math.max(460, ...renderNodesRelayout.map((node) => node.y + 80));

  const handleWheel = React.useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(3, Math.max(0.3, z + delta)));
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  }, [pan]);

  React.useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      setPan({
        x: panStartRef.current.panX + e.clientX - panStartRef.current.x,
        y: panStartRef.current.panY + e.clientY - panStartRef.current.y,
      });
    };
    const onUp = () => setIsPanning(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isPanning]);

  const selectedTypeSet = new Set(selectedTypes);

  function toggleType(type: string) {
    setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]));
  }

  function resetView() {
    setSearch("");
    setFocusEnabled(false);
    setFocusDepth(1);
    setOrphansOnly(false);
    setDegreeFilter("all");
    setSelectedTypes(nodeTypes);
    setSelectedNode("");
    setZoom(0.65);
    setPan({ x: 0, y: 0 });
  }

  return (
    <div className="content-stack">
      <section className="panel">
        <div className="depgraph-controls">
          <input
            type="search"
            className="ui-input"
            placeholder="Find table, function, view, trigger..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="depgraph-control-row">
            <label className="depgraph-inline-check">
              <input type="checkbox" checked={focusEnabled} onChange={(event) => setFocusEnabled(event.target.checked)} />
              <span>Focus on selected node</span>
            </label>
            <div className="depgraph-chip-group" aria-label="Focus depth">
              {FOCUS_DEPTH_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`depgraph-chip ${focusDepth === value ? "active" : ""}`}
                  disabled={!focusEnabled}
                  onClick={() => setFocusDepth(value)}
                >
                  Depth {value}
                </button>
              ))}
            </div>
            <label className="depgraph-inline-check">
              <input type="checkbox" checked={orphansOnly} onChange={(event) => setOrphansOnly(event.target.checked)} />
              <span>Orphans only</span>
            </label>
          </div>

          <div className="depgraph-control-row">
            <label className="depgraph-select-wrap">
              <span>Palette</span>
              <select
                className="ui-input depgraph-select"
                value={paletteId}
                onChange={(event) => setPaletteId(event.target.value as PaletteId)}
              >
                {(Object.keys(PALETTES) as PaletteId[]).map((id) => (
                  <option key={id} value={id}>
                    {PALETTES[id].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="depgraph-select-wrap">
              <span>Connections</span>
              <select
                className="ui-input depgraph-select"
                value={degreeFilter}
                onChange={(event) => setDegreeFilter(event.target.value as DegreeFilter)}
              >
                <option value="all">All</option>
                <option value="0">0 only</option>
                <option value="1">1+</option>
                <option value="3">3+</option>
                <option value="5">5+</option>
                <option value="10">10+</option>
              </select>
            </label>
          </div>

          <div className="depgraph-control-row depgraph-chip-row">
            <button type="button" className="depgraph-chip" onClick={() => setSelectedTypes(nodeTypes)}>
              All Types
            </button>
            <button type="button" className="depgraph-chip" onClick={() => setSelectedNode("")}>
              Clear Selection
            </button>
            <button type="button" className="depgraph-chip" onClick={resetView}>
              Reset Diagram
            </button>
            {nodeTypes.map((type) => {
              const visual = getTypeVisual(paletteId, type);
              return (
                <button
                  key={type}
                  type="button"
                  className={`depgraph-chip ${selectedTypeSet.has(type) ? "active" : ""}`}
                  onClick={() => toggleType(type)}
                  style={{ borderColor: visual.stroke }}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="graph-layout">
        <article className="panel graph-canvas-wrap">
          <div className="graph-zoom-controls">
            <button type="button" className="btn btn-small" onClick={() => setZoom((z) => Math.min(3, z + 0.2))} aria-label="Zoom in">+</button>
            <button type="button" className="btn btn-small" onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))} aria-label="Zoom out">−</button>
            <button type="button" className="btn btn-small" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="Reset zoom">Reset</button>
          </div>
          <div
            ref={containerRef}
            className="graph-pan-zoom"
            onMouseDown={handleMouseDown}
            style={{ cursor: isPanning ? "grabbing" : "grab" }}
          >
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="graph-canvas"
              role="img"
              aria-label="Dependency graph"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              <defs>
                <marker id="depgraph-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                </marker>
              </defs>
              {renderEdgesMeta.edges.map((edge) => {
                const source = renderNodesById.get(edge.source);
                const target = renderNodesById.get(edge.target);
                if (!source || !target) return null;
                const isConnected = selectedNode !== "" && (edge.source === selectedNode || edge.target === selectedNode);
                const stroke = getTypeVisual(paletteId, source.type).edge;
                return (
                  <g key={`${edge.source}-${edge.target}-${edge.label}`}>
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      className={`graph-edge ${isConnected ? "active" : ""}`}
                      style={{
                        stroke,
                        color: stroke,
                        markerEnd: "url(#depgraph-arrow)",
                      }}
                    />
                    {showEdgeLabels ? (
                      <text
                        x={(source.x + target.x) / 2}
                        y={(source.y + target.y) / 2 - 4}
                        textAnchor="middle"
                        className="graph-edge-label"
                      >
                        {edge.label}
                      </text>
                    ) : null}
                    <title>{`${edge.source} ${edge.label} ${edge.target}`}</title>
                  </g>
                );
              })}

              {renderNodesRelayout.map((node) => (
                <GraphNodeCell
                  key={node.id}
                  node={node}
                  active={selectedNode === node.id}
                  visual={getTypeVisual(paletteId, node.type)}
                  onClick={(nodeId) => setSelectedNode((prev) => (prev === nodeId ? "" : nodeId))}
                />
              ))}
            </svg>
          </div>
          <div className="depgraph-footnote">
            <span>Showing {renderNodesRelayout.length} / {model.nodes.length} nodes</span>
            <span>Visible edges: {renderEdgesMeta.totalVisible}</span>
            {renderEdgesMeta.hiddenCount > 0 ? <span>Hidden by cap: {renderEdgesMeta.hiddenCount}</span> : null}
          </div>
        </article>

        <article className="panel depgraph-details-panel">
          <h3>Node Details</h3>
          {!selectedNode ? (
            <p className="empty-state">Select a node to inspect inbound and outbound dependencies.</p>
          ) : (
            <div className="depgraph-details-body">
              <div className="detail-header depgraph-detail-header" style={{ borderColor: selectedNodeVisual.stroke }}>
                <div className="depgraph-detail-node">
                  {React.createElement(getNodeTypeIcon(selectedNodeData?.type ?? "object"), {
                    size: 18,
                    style: { color: selectedNodeVisual.stroke },
                  })}
                  <strong>{selectedNodeData?.label ?? selectedNode}</strong>
                </div>
                <span className="depgraph-type-pill" style={{ borderColor: selectedNodeVisual.stroke, color: selectedNodeVisual.text }}>
                  {selectedNodeData?.type ?? "object"}
                </span>
              </div>
              <div className="depgraph-detail-meta">
                <span>Schema: <code>{selectedNodeData?.schema || "n/a"}</code></span>
                <span>Degree: <strong>{graphMeta.totalDegree.get(selectedNode) ?? 0}</strong></span>
                <span>In: {graphMeta.inDegree.get(selectedNode) ?? 0} | Out: {graphMeta.outDegree.get(selectedNode) ?? 0}</span>
              </div>
              <div className="cluster-row">
                <button type="button" className="btn btn-primary" onClick={() => onOpenDetail("dependency_graph", selectedNode)}>
                  Open Detail Page
                </button>
                <button type="button" className="btn" onClick={() => setSelectedNode("")}>
                  Deselect Node
                </button>
              </div>
              <h4>Connected Edges ({connectedEdges.length})</h4>
              <ul className="edge-list">
                {connectedEdges.slice(0, 24).map((edge) => (
                  <li key={`${edge.source}-${edge.target}-${edge.label}`}>
                    <code>{edge.source}</code>
                    <span className="depgraph-edge-pill">{edge.label}</span>
                    <code>{edge.target}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

function GraphNodeCell({
  node,
  active,
  visual,
  onClick,
}: {
  node: GraphNode;
  active: boolean;
  visual: TypeVisual;
  onClick: (nodeId: string) => void;
}) {
  return (
    <g
      transform={`translate(${node.x - 72}, ${node.y - 24})`}
      onClick={() => onClick(node.id)}
      onMouseDown={(e) => e.stopPropagation()}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(node.id); } }}
      role="button"
    >
      <title>{`${node.label} (${node.type}) - ${node.id}`}</title>
      <rect
        width="144"
        height="48"
        rx="12"
        className={`graph-node ${active ? "active" : ""}`}
        style={{
          fill: visual.fill,
          stroke: active ? visual.activeStroke : visual.stroke,
          strokeWidth: active ? 2.4 : 1.2,
        }}
      />
      <g transform="translate(4, 14)" style={{ color: visual.text }}>
        {React.createElement(getNodeTypeIcon(node.type), { size: 20 })}
      </g>
      <text x="32" y="20" className="graph-node-title" style={{ fill: visual.text }}>
        {node.label.slice(0, 18)}
      </text>
      <text x="32" y="36" className="graph-node-subtitle" style={{ fill: visual.subtitle }}>
        {node.type}
      </text>
    </g>
  );
}
