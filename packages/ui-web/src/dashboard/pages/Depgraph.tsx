import React from "react";
import { EmptyPanel } from "../components/EmptyPanel";
import { getNodeTypeIcon } from "../lib/section-icons";
import { buildGraphModel, type GraphNode } from "../lib/model";
import type { PageProps } from "./page-types";

interface DependenciesPageProps extends PageProps {
  enabled: boolean;
}

const PAGE_SIZE = 120;
const MAX_RENDER_EDGES = 650;

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
  const [page, setPage] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const panStartRef = React.useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);
  const model = React.useMemo(() => buildGraphModel(categories.dependency_graph ?? []), [categories.dependency_graph]);

  React.useEffect(() => {
    if (!selectedNode && model.nodes.length > 0) {
      setSelectedNode(model.nodes[0].id);
    }
  }, [model.nodes, selectedNode]);

  const nodesById = React.useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model.nodes]);
  const isLargeGraph = model.nodes.length > 220;

  const baseNodes = React.useMemo(() => {
    if (!search.trim()) return model.nodes;
    const term = search.toLowerCase();
    return model.nodes.filter((node) => `${node.id} ${node.label} ${node.type}`.toLowerCase().includes(term));
  }, [model.nodes, search]);

  const neighborhood = React.useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const focus = new Set<string>([selectedNode]);
    for (const edge of model.edges) {
      if (edge.source === selectedNode || edge.target === selectedNode) {
        focus.add(edge.source);
        focus.add(edge.target);
      }
    }
    return focus;
  }, [model.edges, selectedNode]);

  const pagedNodes = React.useMemo(() => {
    const start = page * PAGE_SIZE;
    return baseNodes.slice(start, start + PAGE_SIZE);
  }, [baseNodes, page]);

  const renderNodes = React.useMemo(() => {
    if (search.trim()) return baseNodes;
    if (isLargeGraph && neighborhood.size > 0) {
      return model.nodes.filter((node) => neighborhood.has(node.id));
    }
    return pagedNodes;
  }, [baseNodes, isLargeGraph, model.nodes, neighborhood, pagedNodes, search]);

  const renderIdSet = React.useMemo(() => new Set(renderNodes.map((node) => node.id)), [renderNodes]);

  const renderEdges = React.useMemo(() => {
    const edges = model.edges.filter((edge) => renderIdSet.has(edge.source) && renderIdSet.has(edge.target));
    return edges.slice(0, MAX_RENDER_EDGES);
  }, [model.edges, renderIdSet]);

  const connectedEdges = React.useMemo(() => {
    if (!selectedNode) return [];
    return model.edges.filter((edge) => edge.source === selectedNode || edge.target === selectedNode);
  }, [model.edges, selectedNode]);

  const totalPages = Math.max(1, Math.ceil(baseNodes.length / PAGE_SIZE));

  const width = Math.max(860, ...renderNodes.map((node) => node.x + 140));
  const height = Math.max(460, ...renderNodes.map((node) => node.y + 80));

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

  return (
    <div className="content-stack">
      <section className="panel panel-accent">
        <div className="panel-head">
          <div>
            <h2>Live Dependency Graph</h2>
            <p>
              {isLargeGraph
                ? "Large graph detected. Rendering focused subset for performance; click a node to inspect its neighborhood."
                : "Actual dependency nodes and edges from plugin artifacts."}
            </p>
          </div>
          <div className="cluster-row">
            <a className="btn" href="/dependency-graph.html" target="_blank" rel="noreferrer">
              Open Full Graph Page
            </a>
          </div>
        </div>

        <div className="panel-head">
          <input
            type="search"
            className="ui-input"
            placeholder="Find table, function, view, trigger..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {!search.trim() && !isLargeGraph ? (
            <div className="cluster-row">
              <button type="button" className="btn" onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</button>
              <span className="empty-state">Page {page + 1} / {totalPages}</span>
              <button type="button" className="btn" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>Next</button>
            </div>
          ) : null}
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
            {renderEdges.map((edge) => {
              const source = nodesById.get(edge.source);
              const target = nodesById.get(edge.target);
              if (!source || !target) return null;
              return (
                <line
                  key={`${edge.source}-${edge.target}-${edge.label}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  className="graph-edge"
                />
              );
            })}

            {renderNodes.map((node) => (
              <GraphNodeCell key={node.id} node={node} active={selectedNode === node.id} onClick={setSelectedNode} />
            ))}
          </svg>
          </div>
        </article>

        <article className="panel">
          <h3>Node Details</h3>
          {!selectedNode ? (
            <p className="empty-state">Select a node to inspect inbound and outbound dependencies.</p>
          ) : (
            <>
              <div className="detail-header">
                <strong>{nodesById.get(selectedNode)?.label ?? selectedNode}</strong>
                <span>{nodesById.get(selectedNode)?.type ?? "object"}</span>
              </div>
              <button type="button" className="btn btn-primary" onClick={() => onOpenDetail("dependency_graph", selectedNode)}>
                Open Detail Page
              </button>
              <h4>Connected Edges ({connectedEdges.length})</h4>
              <ul className="edge-list">
                {connectedEdges.slice(0, 24).map((edge) => (
                  <li key={`${edge.source}-${edge.target}-${edge.label}`}>
                    <code>{edge.source}</code>
                    <span>{edge.label}</span>
                    <code>{edge.target}</code>
                  </li>
                ))}
              </ul>
            </>
          )}
        </article>
      </section>
    </div>
  );
}

function GraphNodeCell({
  node,
  active,
  onClick,
}: {
  node: GraphNode;
  active: boolean;
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
      <rect width="144" height="48" rx="12" className={`graph-node ${active ? "active" : ""}`} />
      <g transform="translate(4, 14)">
        {React.createElement(getNodeTypeIcon(node.type), { size: 20 })}
      </g>
      <text x="32" y="20" className="graph-node-title">
        {node.label.slice(0, 18)}
      </text>
      <text x="32" y="36" className="graph-node-subtitle">
        {node.type}
      </text>
    </g>
  );
}
