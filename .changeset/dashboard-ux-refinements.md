---
"@sbtools/ui-web": patch
---

Refine dashboard UX across dependency graph, frontend usage, logs, and shared table/details components.

- Improve `/depgraph` interactions:
  - subset relayout for focused/filtered nodes
  - clearer node selection/deselection and reset controls
  - directional edges with arrowheads and relationship labels
  - improved node details presentation and spacing
- Improve `/frontend-usage`:
  - add filter-driven tabbed analysis views (hot components, component map, resource impact)
  - reduce header footprint to prioritize data table real estate
  - improve chart label usability (wider axis labels + full names in tooltip)
- Simplify `/logs` header by removing non-essential intro copy.
- Update shared dashboard UI behaviors/styles used by new views and interactions.
