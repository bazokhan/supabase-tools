---
"@sbtools/ui-web": patch
---

Implement UI Improvement Plan items: CSS token deduplication, SSR renderer cleanup, responsive layout polish

- **§1 CSS Architecture**: Add `generate:tokens` script to sync `shared-tokens.ts` → `shared-tokens.css` at build time; shared-tokens.ts is now the single canonical source; add `--surface-alt` to `.dark` for parity with SHARED_TOKENS_DARK
- **§2 SSR Renderer Cleanup**: migration-audit uses standard `.tab-row` / `.tab-btn` instead of `.chipbar`; add `.table-scroll-wrap` with horizontal scroll fade; apply to migration-audit, depgraph, frontend-usage, logs-viewer tables
- **§3 Responsive Layout**: Hamburger menu moved into topbar at mobile widths with `IconMenu`; stat grid 480px / detail grid 640px breakpoints; table scroll indicator on all SSR tables
