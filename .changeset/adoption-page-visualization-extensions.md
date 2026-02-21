---
"@sbtools/ui-web": minor
---

Adoption page: extended visualizations with tabbed layout

- **Business tabs**: Readiness (release gate, blocking/warnings), Progress (workflow %, managed scope), Risk (RLS gaps, destructive changes, RPC security, opaque blocks), API Surface (endpoint counts, coverage %)
- **Technical tabs**: Overview (stats, donuts, bar charts, confidence), Entities (table + policy/trigger counts, Manage/Exclude), Graph (Mermaid ER from entities + FK), Endpoints, Policies, Opaque (unmodeled SQL)
- **Tools tab**: Adoption workflow and validation pipeline as Mermaid flowcharts
- Fetch full IntentGraph instead of entities only; Map Endpoints refreshes graph
- Run Gate and Run Validation buttons for on-demand checks
- Uses existing Mermaid, Recharts, MiniDonutChart, MiniBarChart; no new dependencies
