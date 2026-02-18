import React from "react";
import { renderPageFrame, Section, StatCard, scriptJsonVar } from "../components/document.js";

export interface DepgraphNode {
  id: string;
  type: string;
  label: string;
  schema: string;
}

export interface DepgraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface DepgraphData {
  nodes: DepgraphNode[];
  edges: DepgraphEdge[];
}

export function renderDepgraphPage(graph: DepgraphData): string {
  const script = [
    scriptJsonVar("__SBT_DEPGRAPH", graph),
    `
(function(){
  const data = window.__SBT_DEPGRAPH || { nodes: [], edges: [] };
  const q = document.getElementById("search");
  const nodeBody = document.getElementById("node-body");
  const edgeBody = document.getElementById("edge-body");
  function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");}
  function render(){
    const term = (q.value || "").toLowerCase();
    const nodes = term ? data.nodes.filter(n => [n.id,n.label,n.type,n.schema].join(" ").toLowerCase().includes(term)) : data.nodes;
    const ids = new Set(nodes.map(n => n.id));
    const edges = term ? data.edges.filter(e => ids.has(e.source) || ids.has(e.target) || e.label.toLowerCase().includes(term)) : data.edges;
    nodeBody.innerHTML = nodes.map(n => '<tr><td><code>'+esc(n.label)+'</code></td><td><span class="badge">'+esc(n.type)+'</span></td><td>'+esc(n.schema)+'</td></tr>').join("");
    edgeBody.innerHTML = edges.map(e => '<tr><td><code>'+esc(e.source)+'</code></td><td><span class="badge">'+esc(e.label)+'</span></td><td><code>'+esc(e.target)+'</code></td></tr>').join("");
  }
  q.addEventListener("input", render);
  render();
})();
`,
  ].join("\n");

  const byType = new Map<string, number>();
  for (const node of graph.nodes) byType.set(node.type, (byType.get(node.type) ?? 0) + 1);

  return renderPageFrame({
    title: "Dependency Graph",
    subtitle: "Explore object relationships across tables, functions, policies, triggers, views, and types.",
    body: (
      <>
        <div className="stats">
          <StatCard label="Nodes" value={graph.nodes.length} />
          <StatCard label="Edges" value={graph.edges.length} />
          <StatCard label="Node Types" value={byType.size} />
        </div>

        <Section title="Filter">
          <input id="search" className="input" placeholder="Search node id, label, schema, or edge label..." />
        </Section>

        <Section title="Nodes">
          <div className="table-scroll-wrap">
            <div className="surface table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Type</th>
                  <th>Schema</th>
                </tr>
              </thead>
              <tbody id="node-body"></tbody>
            </table>
            </div>
          </div>
        </Section>

        <Section title="Edges">
          <div className="table-scroll-wrap">
            <div className="surface table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Relationship</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody id="edge-body"></tbody>
            </table>
            </div>
          </div>
        </Section>
      </>
    ),
    script,
  });
}
