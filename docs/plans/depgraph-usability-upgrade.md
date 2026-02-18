# Depgraph Usability Upgrade (Dashboard-Focused)

## Summary

Improve the dashboard dependency diagram so users can isolate and explore subgraphs, switch type-based color palettes, and apply quick structural filters (orphan/type/connection count).

Scope is the React dashboard depgraph page first (not `dependency-graph.html` parity in this phase).

## Public API / Data Contract Changes

1. Extend `dependency_graph[0]` payload in `packages/plugin-depgraph/src/index.ts` with additive field `nodes`.
2. `nodes` shape: `{ id: string; label: string; type: string; schema: string }[]`.
3. Keep existing `edges` unchanged for backward compatibility.
4. Update model parsing in `packages/ui-web/src/dashboard/lib/model.ts` to prefer `nodes` when present, and fall back to deriving nodes from edges for older plugin outputs.

## Implementation Plan

1. Add node payload in plugin atlas output.
   - File: `packages/plugin-depgraph/src/index.ts`
   - Build a `nodeSummaries` array from `graph.nodes`.
   - Return `dependency_graph: [{ total_nodes, total_edges, relationship_counts, nodes: nodeSummaries, edges: edgeSummaries }]`.

2. Refactor graph model to support richer node metadata and compatibility.
   - File: `packages/ui-web/src/dashboard/lib/model.ts`
   - Extend `GraphNode` to include `schema`.
   - In `buildGraphModel`, read `summary.nodes` if available.
   - Preserve fallback behavior by deriving nodes from edges when `nodes` is missing.
   - Preserve current coordinate layout strategy.

3. Add focus toggle + depth control on click-selected node.
   - File: `packages/ui-web/src/dashboard/pages/Depgraph.tsx`
   - New state: focus enabled/disabled and depth `0..4`.
   - Traversal mode: undirected BFS.
   - Depth `0` = selected node only.
   - Selected node remains visible when focus mode is active.

4. Add quick filters.
   - File: `packages/ui-web/src/dashboard/pages/Depgraph.tsx`
   - Type filter: multi-select chips.
   - Orphan filter: total degree `0`.
   - Connection-count filter: total degree buckets `all`, `0`, `1+`, `3+`, `5+`, `10+`.
   - Compose with search and focus.

5. Add palette presets and type-based styling.
   - Files: `packages/ui-web/src/dashboard/pages/Depgraph.tsx`, `packages/ui-web/src/styles/tokens.css`
   - Presets: `default`, `colorblind`, `high-contrast`, `muted`.
   - Type-specific node colors and consistent edge styling.
   - Include a compact legend.

6. Keep performance safeguards.
   - Preserve edge cap for rendering.
   - Memoize expensive graph computations (neighbors, degree maps, filtered sets).

7. Documentation updates.
   - Files: `docs/plugins/plugin-depgraph.md`, `packages/plugin-depgraph/README.md`
   - Document new dashboard controls and usage.

## Test Cases

1. Payload compatibility:
   - New output includes `dependency_graph[0].nodes`.
   - Legacy edge-only payload still renders.

2. Focus behavior:
   - Depth `0..4` expands correctly from selected node.

3. Filters:
   - Orphan filter returns total-degree-zero nodes.
   - Type multi-select returns union of selected types.
   - Degree buckets match expected thresholds.

4. Composition:
   - Search + type + degree + focus produce deterministic subset.

5. Palette:
   - Switching palette changes type color mapping and legend.

## Assumptions and Defaults

1. Scope is dashboard depgraph page only for this iteration.
2. Focus traversal is undirected.
3. Degree metric is total degree (`in + out`).
4. Orphan means total degree `0`.
5. Depth control is discrete `0..4`.
6. Type filter is multi-select.
7. Default view is full graph (focus off).
8. Palette selector uses built-in presets.
