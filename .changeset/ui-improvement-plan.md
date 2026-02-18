---
"@sbtools/core": patch
"@sbtools/ui-web": patch
"@sbtools/plugin-erd": patch
"@sbtools/plugin-migration-studio": patch
---

UI improvements: ERD dashboard integration, collapsible sidebar, Geist font, charts, sorting, accessibility, and style polish.

**@sbtools/core**
- Fix ERD fallback path: `resolveErdDir()` reads `plugin-erd` config to find the correct `erdOutput` directory instead of hardcoding `docsOutput/entity-relations`
- Serve `dependency-graph.html` and `migration-audit.html` directly from `docsOutput`

**@sbtools/plugin-erd**
- Add `getAtlasData()`: reads generated `.md` files and contributes `erd_diagrams` category to atlas data
- Add `getDashboardView()`: declares ERD section for the React SPA

**@sbtools/plugin-migration-studio**
- Replace hardcoded `#6366f1` with `var(--accent-hover)`, `#09090b` with `var(--bg)`
- Align button `border-radius` to `var(--radius-md)`
- Replace `.badge-applied/.badge-pending/.badge-missing` text classes with full badge styling
- Add migration stat summary cards (Total, Applied, Pending, Missing)

**@sbtools/ui-web**
- ERD page (`Erd.tsx`, `MermaidRenderer.tsx`): renders Mermaid diagrams with search and raw source toggle
- Collapsible sidebar: icon-only 56px collapsed state, `‹`/`›` toggle, persisted via localStorage
- Font: replace Sora + IBM Plex Mono with Geist + Geist Mono across SPA and SSR pages
- Charts: `MiniBarChart` (Overview entity counts), `MiniDonutChart` (Migrations applied/pending/missing)
- Loading: `ShellLoadingSkeleton` replaces plain text loading state
- Dropdown component: used for multi-action header buttons (Migrations, Depgraph)
- EmptyState component: unified empty state replacing ad-hoc `<p class="empty-state">` usage
- AppDataTable + DataTable: sortable columns, 50-row pagination, column resize handles, Badge for status/type fields, ValueRenderer with compact prop
- Overview: StatCard with click-to-filter, tab overflow Dropdown at 12+ tabs, MiniBarChart
- Details: graph node detail redesign with metadata grid, inbound/outbound edge tables, Badge for node type
- Depgraph: wheel zoom, mouse-drag pan, zoom reset controls
- Logs: responsive height (`calc(100vh - 320px)`), Badge for connection status
- Search: Ctrl+K hotkey, arrow key navigation, Enter to select, clear on navigate, click-outside to close, Ctrl+K trailing badge
- Accessibility: skip link, ARIA labels on nav/search/theme toggle, graph node keyboard support (`tabIndex`, Enter/Space)
- Icons: IconTable, IconFunction, IconView, IconTrigger, IconPolicy, IconKey, IconEnum, IconType, IconErd, IconChart, IconCopy, IconExpand, IconFilter — used in search results, detail headers, section nav
- SSR: move chip-bar, toolbar, tab, log-wrap patterns into `baseCss`; remove inline `pageCss` from `migration-audit` and `logs-viewer` renderers
- Responsive: mobile hamburger + backdrop overlay, stat grid 2-col at 480px, detail grid 1-col at 640px, table horizontal scroll shadow
- Transitions: theme color fade, sidebar width, route fade-in
- CSS tokens: `shared-tokens.css` as single source; `tokens.css` imports it
