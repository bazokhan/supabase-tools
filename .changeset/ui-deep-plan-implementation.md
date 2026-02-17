---
"@sbtools/sdk": minor
"@sbtools/ui-web": minor
"@sbtools/plugin-migration-studio": minor
---

Implement UI deep modernization plan: Details page fix, shared tokens, ValueRenderer, Tooltip, icons.

**SDK**
- Add optional `primaryKeyField` to `DashboardSectionDef` for section-aware detail lookup

**ui-web**
- Fix Details page 404 for dependency_graph: use buildGraphModel nodes for lookup, render node-centric view with connected edges
- Add `findDetailTarget`, `getSectionPrimaryKeyField`; update `getPrimaryKey` to accept optional `primaryKeyField`
- Add `buildSearchIndex` support for dependency_graph (nodes as search hits) and optional sections for primaryKeyField
- Extract shared tokens: `SHARED_TOKENS_CSS`, `SHARED_TOKENS_DARK` in `shared-tokens.ts`; document.tsx and plugin-migration-studio consume them
- Add `ValueRenderer`: collapsible JSON tree, SQL keyword highlighting, format auto-detection; integrate in Details and GenericSection
- Add `Tooltip` component; apply to theme toggle
- Add `IconInfo`, `IconAlert`, `IconCheck`, `IconX`
- Add search popover fade-in animation

**plugin-migration-studio**
- Import and use `SHARED_TOKENS_DARK` from ui-web; remove duplicate token definitions
