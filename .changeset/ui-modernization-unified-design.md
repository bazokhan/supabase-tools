---
"@sbtools/ui-web": minor
"@sbtools/plugin-migration-studio": minor
---

Unify UI design system across dashboard, SSR pages, and Migration Studio.

**ui-web**
- Rewrite `tokens.css`: modern neutral scale (slate/zinc), indigo accent palette, secondary teal, remove blue/green gradients and glassmorphism
- Reduce border overload: use `--border-subtle` (0.05 opacity) for most elements
- Reduce radius (12px max panels, 8px cards/inputs)
- Widen layout: remove `max-width: 1400px`, sidebar 240px, fluid padding
- Add styles for StatCard, Badge, CardGrid, ExpandableCard, GenericSection, DataTable, CodeBlock
- Align `document.tsx` baseCss to same tokens and Sora/IBM Plex Mono fonts
- Add `.dark` support to SSR baseCss

**plugin-migration-studio**
- Align `styles.ts` to dashboard dark tokens (same vars, no radial gradients)
- Solid backgrounds, softer borders, flat accent buttons
