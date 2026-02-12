/**
 * html-generator.ts
 *
 * Builds a self-contained interactive HTML page that visualizes the
 * dependency graph using inline SVG with a force-directed layout.
 * No external libraries required.
 */
import fs from "node:fs";
import path from "node:path";
import type { DependencyGraph } from "./graph-builder.js";

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateHtml(graph: DependencyGraph): string {
  const graphJson = JSON.stringify(graph);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dependency Graph</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0f172a;
    --surface: #1e293b;
    --border: #334155;
    --text: #e2e8f0;
    --text-muted: #94a3b8;
    --text-dim: #64748b;
    --accent: #3b82f6;
    --highlight: #f59e0b;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg);
    color: var(--text);
    overflow: hidden;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ── Toolbar ── */
  #toolbar {
    flex-shrink: 0;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 10;
  }
  #toolbar h1 { font-size: 0.95rem; font-weight: 600; white-space: nowrap; }
  #search {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    padding: 5px 10px;
    font-size: 0.8rem;
    width: 180px;
    outline: none;
    transition: border-color .15s;
  }
  #search:focus { border-color: var(--accent); }
  #search::placeholder { color: var(--text-dim); }

  .chip-bar { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip {
    display: flex; align-items: center; gap: 4px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    user-select: none;
    border: 1.5px solid transparent;
    transition: opacity .15s, border-color .15s;
  }
  .chip.off { opacity: 0.35; }
  .chip .dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  #stats {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
  }
  .tb-btn {
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 6px; color: var(--text-muted);
    padding: 4px 10px; font-size: 0.75rem; cursor: pointer;
    transition: color .15s, border-color .15s;
  }
  .tb-btn:hover { color: var(--text); border-color: var(--text-dim); }

  /* ── Main area ── */
  #main {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  /* ── SVG canvas ── */
  #canvas-wrap {
    flex: 1;
    position: relative;
    cursor: grab;
  }
  #canvas-wrap.dragging-node { cursor: grabbing; }
  #canvas-wrap.panning { cursor: grabbing; }
  svg { width: 100%; height: 100%; display: block; }

  /* Edge */
  .edge-path {
    fill: none;
    stroke: #475569;
    stroke-width: 1.4;
    transition: stroke .2s, stroke-width .2s, opacity .2s;
  }
  .edge-path.hl { stroke: var(--highlight); stroke-width: 2.8; }
  .edge-path.dim { opacity: 0.06; }
  .edge-label-bg { fill: var(--bg); opacity: 0.85; }
  .edge-label {
    font-size: 9px; fill: var(--text-dim);
    text-anchor: middle; dominant-baseline: central;
    pointer-events: none;
    transition: opacity .2s;
  }
  .edge-label.dim { opacity: 0.06; }
  .edge-label.hl { fill: var(--highlight); font-weight: 600; }

  /* Node */
  .node { cursor: grab; transition: opacity .2s; }
  .node:active { cursor: grabbing; }
  .node.dim { opacity: 0.08; }
  .node.hl .node-shape { stroke-width: 3; filter: drop-shadow(0 0 8px rgba(245,158,11,0.5)); }
  .node.selected .node-shape { stroke: var(--highlight) !important; stroke-width: 3; filter: drop-shadow(0 0 10px rgba(245,158,11,0.6)); }
  .node-shape { transition: stroke .2s, stroke-width .2s, filter .2s; }
  .node-label {
    font-size: 11px;
    font-weight: 500;
    text-anchor: middle;
    dominant-baseline: central;
    pointer-events: none;
  }
  .node-type-label {
    font-size: 8px;
    text-anchor: middle;
    fill: var(--text-dim);
    pointer-events: none;
  }

  /* ── Detail panel ── */
  #panel {
    width: 320px;
    flex-shrink: 0;
    background: var(--surface);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform .2s ease;
    overflow: hidden;
    position: absolute;
    right: 0; top: 0; bottom: 0;
    z-index: 5;
  }
  #panel.open { transform: translateX(0); }
  .panel-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .panel-header-info { flex: 1; min-width: 0; }
  .panel-title {
    font-size: 1rem;
    font-weight: 700;
    word-break: break-word;
  }
  .panel-subtitle {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 2px;
  }
  .panel-close {
    background: none; border: none; color: var(--text-dim);
    font-size: 1.1rem; cursor: pointer; padding: 2px 6px;
    border-radius: 4px; line-height: 1;
  }
  .panel-close:hover { color: var(--text); background: var(--bg); }
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px 20px;
  }
  .panel-section { margin-bottom: 16px; }
  .panel-section h3 {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
    margin-bottom: 6px;
  }
  .dep-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background .1s;
  }
  .dep-item:hover { background: var(--bg); }
  .dep-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dep-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dep-rel {
    font-size: 0.68rem;
    color: var(--text-dim);
    flex-shrink: 0;
  }
  .meta-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 10px;
    font-size: 0.78rem;
  }
  .meta-key { color: var(--text-dim); }
  .meta-val { color: var(--text); word-break: break-all; }
  .panel-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 600;
  }

  /* ── Tooltip (hover) ── */
  #tip {
    position: fixed;
    display: none;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 0.78rem;
    pointer-events: none;
    z-index: 30;
    max-width: 260px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
  #tip .tip-name { font-weight: 600; }
  #tip .tip-type { color: var(--text-muted); font-size: 0.7rem; margin-top: 1px; }
</style>
</head>
<body>

<div id="toolbar">
  <h1>Dependency Graph</h1>
  <input type="text" id="search" placeholder="Search nodes...">
  <div class="chip-bar" id="chips"></div>
  <button class="tb-btn" id="btn-fit" title="Fit graph to viewport">Fit</button>
  <div id="stats"></div>
</div>

<div id="main">
  <div id="canvas-wrap">
    <svg id="svg"></svg>
  </div>
  <div id="panel">
    <div class="panel-header">
      <div class="panel-header-info">
        <div class="panel-title" id="p-title"></div>
        <div class="panel-subtitle" id="p-sub"></div>
      </div>
      <button class="panel-close" id="p-close">&times;</button>
    </div>
    <div class="panel-body" id="p-body"></div>
  </div>
</div>

<div id="tip"><div class="tip-name"></div><div class="tip-type"></div></div>

<script>
(function() {
"use strict";

/* ================================================================
   DATA
   ================================================================ */
var G = ${graphJson};
var nodes = G.nodes, edges = G.edges;
var N = nodes.length, E = edges.length;

var COLORS = {
  table:             { bg:"#dbeafe", border:"#2563eb", text:"#1e3a5f" },
  function:          { bg:"#dcfce7", border:"#16a34a", text:"#14532d" },
  trigger:           { bg:"#ffedd5", border:"#ea580c", text:"#7c2d12" },
  policy:            { bg:"#f3e8ff", border:"#9333ea", text:"#581c87" },
  view:              { bg:"#ccfbf1", border:"#0d9488", text:"#134e4a" },
  materialized_view: { bg:"#ccfbf1", border:"#0d9488", text:"#134e4a" },
  enum:              { bg:"#fce7f3", border:"#db2777", text:"#831843" },
  type:              { bg:"#fef3c7", border:"#d97706", text:"#78350f" }
};

var TYPE_LABELS = {
  table:"Table", function:"Function", trigger:"Trigger", policy:"Policy",
  view:"View", materialized_view:"Mat. View", enum:"Enum", type:"Type"
};

// Index helpers
var idIdx = {};
for (var i = 0; i < N; i++) {
  idIdx[nodes[i].id] = i;
  var n = nodes[i];
  n._w = Math.max(n.label.length * 7.5 + 24, 70);
  n._h = 36;
  n._x = 0; n._y = 0; n._vx = 0; n._vy = 0;
  n._vis = true;
  n._fixed = false;
}

// Adjacency
var adjOut = new Array(N), adjIn = new Array(N);
for (var i = 0; i < N; i++) { adjOut[i] = []; adjIn[i] = []; }
for (var e = 0; e < E; e++) {
  var si = idIdx[edges[e].source], ti = idIdx[edges[e].target];
  if (si !== undefined && ti !== undefined) {
    adjOut[si].push({ edge: e, node: ti });
    adjIn[ti].push({ edge: e, node: si });
  }
}

/* ================================================================
   VISIBILITY STATE
   ================================================================ */
var hiddenTypes = {};
var searchQ = "";
var selectedIdx = -1;

var types = []; var seen = {};
for (var i = 0; i < N; i++) { if (!seen[nodes[i].type]) { seen[nodes[i].type] = 1; types.push(nodes[i].type); } }
types.sort();

/* ================================================================
   LAYOUT — computed once, synchronously, before first render
   ================================================================ */
function computeLayout() {
  var cx = 600, cy = 400;
  // Seed positions in a circle
  for (var i = 0; i < N; i++) {
    var a = (2 * Math.PI * i) / N;
    var r = 250 + (i % 3) * 40;
    nodes[i]._x = cx + r * Math.cos(a);
    nodes[i]._y = cy + r * Math.sin(a);
    nodes[i]._vx = 0;
    nodes[i]._vy = 0;
  }

  var repK = 14000, attK = 0.004, idealLen = 220, centerK = 0.01;
  var alpha = 1, decay = 0.97, iterations = 300;

  for (var iter = 0; iter < iterations; iter++) {
    // Repulsion (all visible pairs)
    for (var i = 0; i < N; i++) {
      for (var j = i + 1; j < N; j++) {
        var dx = nodes[j]._x - nodes[i]._x;
        var dy = nodes[j]._y - nodes[i]._y;
        var d2 = dx * dx + dy * dy;
        if (d2 < 1) d2 = 1;
        var d = Math.sqrt(d2);
        var f = repK / d2 * alpha;
        var fx = (dx / d) * f, fy = (dy / d) * f;
        nodes[i]._vx -= fx; nodes[i]._vy -= fy;
        nodes[j]._vx += fx; nodes[j]._vy += fy;
      }
    }
    // Attraction (edges)
    for (var e = 0; e < E; e++) {
      var si = idIdx[edges[e].source], ti = idIdx[edges[e].target];
      if (si === undefined || ti === undefined) continue;
      var dx = nodes[ti]._x - nodes[si]._x;
      var dy = nodes[ti]._y - nodes[si]._y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var f = (d - idealLen) * attK * alpha;
      var fx = (dx / d) * f, fy = (dy / d) * f;
      nodes[si]._vx += fx; nodes[si]._vy += fy;
      nodes[ti]._vx -= fx; nodes[ti]._vy -= fy;
    }
    // Center pull + apply velocities
    for (var i = 0; i < N; i++) {
      nodes[i]._vx += (cx - nodes[i]._x) * centerK * alpha;
      nodes[i]._vy += (cy - nodes[i]._y) * centerK * alpha;
      nodes[i]._vx *= 0.55;
      nodes[i]._vy *= 0.55;
      nodes[i]._x += nodes[i]._vx;
      nodes[i]._y += nodes[i]._vy;
    }
    alpha *= decay;
  }
}

/* ================================================================
   SVG ELEMENTS
   ================================================================ */
var svgEl = document.getElementById("svg");
var NS = "http://www.w3.org/2000/svg";
function ce(tag, attrs) {
  var el = document.createElementNS(NS, tag);
  if (attrs) for (var k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

// Defs
var defs = ce("defs");
// Two arrowhead variants: normal and highlighted
["arrow","arrow-hl"].forEach(function(id) {
  var m = ce("marker", { id: id, viewBox: "0 0 10 6", refX: "9", refY: "3", markerWidth: "7", markerHeight: "5", orient: "auto" });
  m.appendChild(ce("path", { d: "M0,0.5 L9,3 L0,5.5Z", fill: id === "arrow-hl" ? "#f59e0b" : "#475569" }));
  defs.appendChild(m);
});
svgEl.appendChild(defs);

var gMain = ce("g", { id: "gm" });
svgEl.appendChild(gMain);
var gEdges = ce("g"); gMain.appendChild(gEdges);
var gNodes = ce("g"); gMain.appendChild(gNodes);

// Build edge elements
var edgePaths = [], edgeLbls = [], edgeBgs = [];
for (var e = 0; e < E; e++) {
  var p = ce("path", { class: "edge-path", "marker-end": "url(#arrow)" });
  p._idx = e;
  gEdges.appendChild(p);
  edgePaths.push(p);

  var bg = ce("rect", { class: "edge-label-bg", rx: "3", ry: "3", width: "0", height: "0" });
  gEdges.appendChild(bg);
  edgeBgs.push(bg);

  var t = ce("text", { class: "edge-label" });
  t.textContent = edges[e].label;
  t._idx = e;
  gEdges.appendChild(t);
  edgeLbls.push(t);
}

// Build node elements
var nodeGs = [];
for (var i = 0; i < N; i++) {
  var n = nodes[i];
  var c = COLORS[n.type] || { bg:"#ccc", border:"#999", text:"#333" };
  var g = ce("g", { class: "node" });
  g._idx = i;

  var isRound = n.type === "enum" || n.type === "function";
  var shape;
  if (isRound) {
    shape = ce("rect", {
      x: String(-n._w/2), y: String(-n._h/2), width: String(n._w), height: String(n._h),
      rx: String(n._h/2), ry: String(n._h/2),
      fill: c.bg, stroke: c.border, "stroke-width": "2", class: "node-shape"
    });
  } else {
    shape = ce("rect", {
      x: String(-n._w/2), y: String(-n._h/2), width: String(n._w), height: String(n._h),
      rx: "6", ry: "6",
      fill: c.bg, stroke: c.border, "stroke-width": "2", class: "node-shape"
    });
  }
  g.appendChild(shape);

  // Type label above
  var tt = ce("text", { class: "node-type-label", y: String(-n._h/2 - 5) });
  tt.textContent = TYPE_LABELS[n.type] || n.type;
  g.appendChild(tt);

  // Name label
  var lbl = ce("text", { class: "node-label", fill: c.text });
  lbl.textContent = n.label;
  g.appendChild(lbl);

  gNodes.appendChild(g);
  nodeGs.push(g);
}

/* ================================================================
   RENDERING
   ================================================================ */
function updatePositions() {
  for (var i = 0; i < N; i++) {
    nodeGs[i].setAttribute("transform", "translate(" + nodes[i]._x.toFixed(1) + "," + nodes[i]._y.toFixed(1) + ")");
  }
  for (var e = 0; e < E; e++) {
    var si = idIdx[edges[e].source], ti = idIdx[edges[e].target];
    if (si === undefined || ti === undefined) continue;
    var sx = nodes[si]._x, sy = nodes[si]._y;
    var tx = nodes[ti]._x, ty = nodes[ti]._y;
    var dx = tx - sx, dy = ty - sy;
    var dist = Math.sqrt(dx*dx + dy*dy) || 1;
    var ux = dx/dist, uy = dy/dist;

    // Clip to target rect edge
    var hw = nodes[ti]._w/2 + 6, hh = nodes[ti]._h/2 + 6;
    var clipR = Math.min(hw / (Math.abs(ux)||0.001), hh / (Math.abs(uy)||0.001));
    var ex = tx - ux * clipR, ey = ty - uy * clipR;

    // Clip from source rect edge
    var shw = nodes[si]._w/2 + 4, shh = nodes[si]._h/2 + 4;
    var clipS = Math.min(shw / (Math.abs(ux)||0.001), shh / (Math.abs(uy)||0.001));
    var bx = sx + ux * clipS, by = sy + uy * clipS;

    // Slight curve via perpendicular offset for parallel edges
    var off = 0;
    // Check if there's a reverse edge
    for (var e2 = 0; e2 < E; e2++) {
      if (e2 !== e && edges[e2].source === edges[e].target && edges[e2].target === edges[e].source) {
        off = 25; break;
      }
    }
    var mx = (bx + ex)/2 + (-uy)*off;
    var my = (by + ey)/2 + ux*off;
    edgePaths[e].setAttribute("d", "M"+bx.toFixed(1)+","+by.toFixed(1)+" Q"+mx.toFixed(1)+","+my.toFixed(1)+" "+ex.toFixed(1)+","+ey.toFixed(1));

    // Label position
    var lx = mx, ly = my - 7;
    edgeLbls[e].setAttribute("x", lx.toFixed(1));
    edgeLbls[e].setAttribute("y", ly.toFixed(1));

    // Label background
    var bb = edgeLbls[e].getBBox ? edgeLbls[e].getBBox() : null;
    if (bb && bb.width > 0) {
      edgeBgs[e].setAttribute("x", String(bb.x - 3));
      edgeBgs[e].setAttribute("y", String(bb.y - 1));
      edgeBgs[e].setAttribute("width", String(bb.width + 6));
      edgeBgs[e].setAttribute("height", String(bb.height + 2));
    }
  }
}

/* ================================================================
   PAN / ZOOM
   ================================================================ */
var vx = 0, vy = 0, vscale = 1;
function setTransform() { gMain.setAttribute("transform", "translate("+vx+","+vy+") scale("+vscale+")"); }

var wrap = document.getElementById("canvas-wrap");
var panning = false, panSX, panSY, panVX, panVY;

wrap.addEventListener("mousedown", function(ev) {
  if (ev.button !== 0) return;
  if (ev.target.closest(".node")) return;
  panning = true;
  panSX = ev.clientX; panSY = ev.clientY;
  panVX = vx; panVY = vy;
  wrap.classList.add("panning");
});
window.addEventListener("mousemove", function(ev) {
  if (!panning) return;
  vx = panVX + (ev.clientX - panSX);
  vy = panVY + (ev.clientY - panSY);
  setTransform();
});
window.addEventListener("mouseup", function() { panning = false; wrap.classList.remove("panning"); });

wrap.addEventListener("wheel", function(ev) {
  ev.preventDefault();
  var f = ev.deltaY > 0 ? 0.92 : 1.08;
  var ns = Math.max(0.08, Math.min(6, vscale * f));
  var r = svgEl.getBoundingClientRect();
  var cx = ev.clientX - r.left, cy = ev.clientY - r.top;
  vx = cx - (cx - vx) * (ns / vscale);
  vy = cy - (cy - vy) * (ns / vscale);
  vscale = ns;
  setTransform();
}, { passive: false });

function fitToView() {
  var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (var i=0;i<N;i++){
    if(!nodes[i]._vis)continue;
    minX=Math.min(minX,nodes[i]._x-nodes[i]._w/2);
    maxX=Math.max(maxX,nodes[i]._x+nodes[i]._w/2);
    minY=Math.min(minY,nodes[i]._y-nodes[i]._h/2-12);
    maxY=Math.max(maxY,nodes[i]._y+nodes[i]._h/2);
  }
  if(!isFinite(minX))return;
  var pad=60;
  var gw=maxX-minX+pad*2, gh=maxY-minY+pad*2;
  var r=svgEl.getBoundingClientRect();
  var sw=r.width, sh=r.height;
  vscale=Math.min(sw/gw, sh/gh, 1.5);
  vx=sw/2-((minX+maxX)/2)*vscale;
  vy=sh/2-((minY+maxY)/2)*vscale;
  setTransform();
}

/* ================================================================
   NODE DRAGGING — purely positional, no physics
   ================================================================ */
var dragIdx = -1, dragOX, dragOY, didDrag = false;

gNodes.addEventListener("mousedown", function(ev) {
  var g = ev.target.closest(".node");
  if (!g || ev.button !== 0) return;
  ev.stopPropagation();
  dragIdx = g._idx;
  didDrag = false;
  var pt = svgCoords(ev);
  dragOX = pt.x - nodes[dragIdx]._x;
  dragOY = pt.y - nodes[dragIdx]._y;
  wrap.classList.add("dragging-node");
});

window.addEventListener("mousemove", function(ev) {
  if (dragIdx < 0) return;
  didDrag = true;
  var pt = svgCoords(ev);
  nodes[dragIdx]._x = pt.x - dragOX;
  nodes[dragIdx]._y = pt.y - dragOY;
  updatePositions();
});

window.addEventListener("mouseup", function() {
  if (dragIdx < 0) return;
  dragIdx = -1;
  wrap.classList.remove("dragging-node");
});

function svgCoords(ev) {
  var r = svgEl.getBoundingClientRect();
  return { x: (ev.clientX - r.left - vx) / vscale, y: (ev.clientY - r.top - vy) / vscale };
}

/* ================================================================
   NODE CLICK → DETAIL PANEL
   ================================================================ */
var panel = document.getElementById("panel");

gNodes.addEventListener("click", function(ev) {
  if (didDrag) return;
  var g = ev.target.closest(".node");
  if (!g) return;
  var idx = g._idx;
  if (selectedIdx === idx) { closePanel(); return; }
  selectNode(idx);
});

svgEl.addEventListener("click", function(ev) {
  if (!ev.target.closest(".node")) closePanel();
});

document.getElementById("p-close").addEventListener("click", closePanel);

function selectNode(idx) {
  selectedIdx = idx;
  var n = nodes[idx];
  var c = COLORS[n.type] || { bg:"#ccc", border:"#999" };

  // Header
  document.getElementById("p-title").textContent = n.label;
  document.getElementById("p-sub").innerHTML =
    '<span class="panel-badge" style="background:'+c.bg+';color:'+c.text+'">'+(TYPE_LABELS[n.type]||n.type)+'</span>' +
    ' <span style="color:#94a3b8;font-size:0.72rem">'+n.schema+'</span>';

  // Body
  var html = '';

  // Outgoing
  var out = adjOut[idx];
  if (out.length) {
    html += '<div class="panel-section"><h3>Depends on (' + out.length + ')</h3>';
    for (var i = 0; i < out.length; i++) {
      var tn = nodes[out[i].node];
      var tc = COLORS[tn.type] || { bg:"#ccc", border:"#999" };
      html += '<div class="dep-item" data-idx="'+out[i].node+'">' +
        '<span class="dep-dot" style="background:'+tc.bg+';border:1.5px solid '+tc.border+'"></span>' +
        '<span class="dep-name">'+esc(tn.label)+'</span>' +
        '<span class="dep-rel">'+esc(edges[out[i].edge].label)+'</span></div>';
    }
    html += '</div>';
  }

  // Incoming
  var inc = adjIn[idx];
  if (inc.length) {
    html += '<div class="panel-section"><h3>Depended on by (' + inc.length + ')</h3>';
    for (var i = 0; i < inc.length; i++) {
      var sn = nodes[inc[i].node];
      var sc = COLORS[sn.type] || { bg:"#ccc", border:"#999" };
      html += '<div class="dep-item" data-idx="'+inc[i].node+'">' +
        '<span class="dep-dot" style="background:'+sc.bg+';border:1.5px solid '+sc.border+'"></span>' +
        '<span class="dep-name">'+esc(sn.label)+'</span>' +
        '<span class="dep-rel">'+esc(edges[inc[i].edge].label)+'</span></div>';
    }
    html += '</div>';
  }

  if (!out.length && !inc.length) {
    html += '<div class="panel-section" style="color:var(--text-dim);font-size:0.82rem;">No dependencies.</div>';
  }

  // Metadata
  var mk = Object.keys(n.metadata || {}).filter(function(k){return n.metadata[k];});
  if (mk.length) {
    html += '<div class="panel-section"><h3>Details</h3><div class="meta-grid">';
    for (var i = 0; i < mk.length; i++) {
      html += '<span class="meta-key">'+esc(mk[i])+'</span><span class="meta-val">'+esc(n.metadata[mk[i]])+'</span>';
    }
    html += '</div></div>';
  }

  document.getElementById("p-body").innerHTML = html;

  // Click-through on dep items
  document.getElementById("p-body").querySelectorAll(".dep-item").forEach(function(el) {
    el.addEventListener("click", function() { selectNode(parseInt(el.dataset.idx)); });
  });

  panel.classList.add("open");
  applyHighlights();
}

function closePanel() {
  selectedIdx = -1;
  panel.classList.remove("open");
  clearHighlights();
}

/* ================================================================
   HIGHLIGHTS
   ================================================================ */
function applyHighlights() {
  if (selectedIdx < 0) { clearHighlights(); return; }
  var conn = new Set();
  conn.add(selectedIdx);
  var connEdges = new Set();
  for (var i = 0; i < adjOut[selectedIdx].length; i++) { conn.add(adjOut[selectedIdx][i].node); connEdges.add(adjOut[selectedIdx][i].edge); }
  for (var i = 0; i < adjIn[selectedIdx].length; i++) { conn.add(adjIn[selectedIdx][i].node); connEdges.add(adjIn[selectedIdx][i].edge); }

  for (var i = 0; i < N; i++) {
    var g = nodeGs[i];
    g.classList.toggle("dim", !conn.has(i));
    g.classList.toggle("hl", conn.has(i) && i !== selectedIdx);
    g.classList.toggle("selected", i === selectedIdx);
  }
  for (var e = 0; e < E; e++) {
    edgePaths[e].classList.toggle("dim", !connEdges.has(e));
    edgePaths[e].classList.toggle("hl", connEdges.has(e));
    edgePaths[e].setAttribute("marker-end", connEdges.has(e) ? "url(#arrow-hl)" : "url(#arrow)");
    edgeLbls[e].classList.toggle("dim", !connEdges.has(e));
    edgeLbls[e].classList.toggle("hl", connEdges.has(e));
    edgeBgs[e].style.display = connEdges.has(e) ? "" : "none";
  }
}

function clearHighlights() {
  for (var i = 0; i < N; i++) {
    nodeGs[i].classList.remove("dim","hl","selected");
  }
  for (var e = 0; e < E; e++) {
    edgePaths[e].classList.remove("dim","hl");
    edgePaths[e].setAttribute("marker-end","url(#arrow)");
    edgeLbls[e].classList.remove("dim","hl");
    edgeBgs[e].style.display = "none";
  }
}

/* ================================================================
   HOVER TOOLTIP
   ================================================================ */
var tip = document.getElementById("tip");
gNodes.addEventListener("mouseover", function(ev) {
  var g = ev.target.closest(".node");
  if (!g) return;
  var n = nodes[g._idx];
  tip.querySelector(".tip-name").textContent = n.label;
  tip.querySelector(".tip-type").textContent = (TYPE_LABELS[n.type]||n.type) + " \u00b7 " + n.schema;
  tip.style.display = "block";
});
gNodes.addEventListener("mouseout", function(ev) {
  if (!ev.target.closest(".node")) return;
  tip.style.display = "none";
});
window.addEventListener("mousemove", function(ev) {
  if (tip.style.display === "block") { tip.style.left = (ev.clientX+14)+"px"; tip.style.top = (ev.clientY+14)+"px"; }
});

/* ================================================================
   FILTER CHIPS + SEARCH
   ================================================================ */
var chipsEl = document.getElementById("chips");
types.forEach(function(t) {
  var c = COLORS[t] || { bg:"#ccc", border:"#999" };
  var chip = document.createElement("div");
  chip.className = "chip";
  chip.style.background = c.bg; chip.style.color = c.text; chip.style.borderColor = c.border;
  chip.innerHTML = '<span class="dot" style="background:'+c.border+'"></span>' + (TYPE_LABELS[t]||t);
  chip._type = t;
  chip.addEventListener("click", function() {
    if (hiddenTypes[t]) { delete hiddenTypes[t]; chip.classList.remove("off"); }
    else { hiddenTypes[t] = true; chip.classList.add("off"); }
    applyVis();
  });
  chipsEl.appendChild(chip);
});

document.getElementById("search").addEventListener("input", function(ev) {
  searchQ = ev.target.value.toLowerCase();
  applyVis();
});

document.getElementById("btn-fit").addEventListener("click", fitToView);

function applyVis() {
  for (var i = 0; i < N; i++) {
    var n = nodes[i];
    var vis = !hiddenTypes[n.type] && (!searchQ || n.label.toLowerCase().indexOf(searchQ) !== -1 || n.id.toLowerCase().indexOf(searchQ) !== -1);
    n._vis = vis;
    nodeGs[i].style.display = vis ? "" : "none";
  }
  for (var e = 0; e < E; e++) {
    var si = idIdx[edges[e].source], ti = idIdx[edges[e].target];
    var vis = si !== undefined && ti !== undefined && nodes[si]._vis && nodes[ti]._vis;
    edgePaths[e].style.display = vis ? "" : "none";
    edgeLbls[e].style.display = vis ? "" : "none";
    edgeBgs[e].style.display = "none";
  }
  updateStats();
  if (selectedIdx >= 0 && !nodes[selectedIdx]._vis) closePanel();
  else if (selectedIdx >= 0) applyHighlights();
  updatePositions();
}

function updateStats() {
  var vn = 0, ve = 0;
  for (var i = 0; i < N; i++) if (nodes[i]._vis) vn++;
  for (var e = 0; e < E; e++) {
    var si = idIdx[edges[e].source], ti = idIdx[edges[e].target];
    if (si !== undefined && ti !== undefined && nodes[si]._vis && nodes[ti]._vis) ve++;
  }
  document.getElementById("stats").textContent = vn + " nodes, " + ve + " edges";
}

function esc(s) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

/* ================================================================
   INIT — compute layout once, render, fit
   ================================================================ */
computeLayout();
updatePositions();
updateStats();
// Fit after browser has rendered so getBBox works
requestAnimationFrame(function() { fitToView(); });

// Keyboard: Escape closes panel
document.addEventListener("keydown", function(ev) { if (ev.key === "Escape") closePanel(); });

})();
</script>
</body>
</html>`;
}

export function writeHtml(
  graph: DependencyGraph,
  outputPath: string,
): void {
  const content = generateHtml(graph);
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, content, "utf-8");
}
