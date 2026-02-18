---
"@sbtools/plugin-depgraph": patch
"@sbtools/ui-web": patch
---

Improve dependency graph usability in the dashboard with focus-depth controls, palette presets, and quick structural filters.

**@sbtools/plugin-depgraph**
- Extend `dependency_graph` atlas category payload with additive `nodes` array (`id`, `label`, `type`, `schema`) for richer graph consumers.
- Keep existing `edges` payload unchanged for backward compatibility.

**@sbtools/ui-web**
- Upgrade `/depgraph` page controls:
  - Focus toggle with selectable depth (`0..4`) from selected node
  - Palette selector with built-in presets (`Default`, `Colorblind-safe`, `High contrast`, `Muted`)
  - Quick filters: orphan-only, type multi-select, and connection-count buckets
- Use payload `nodes` when available and fall back to edge-derived nodes for older depgraph outputs.
- Add depgraph-specific UI styles for filter controls, chips, legend, and visibility counters.
