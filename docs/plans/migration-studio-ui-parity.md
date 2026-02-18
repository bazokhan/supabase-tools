# Migration Studio UI Parity With ui-web

## Goal

Make Migration Studio match `@sbtools/ui-web` dashboard visual language (fonts, components, spacing, buttons, panels, tabs, and interaction states).

## Scope

- Update migration studio HTML layout classes in `packages/ui-web/src/renderers/migration-studio.ts`.
- Replace plugin-local CSS theme with ui-web-aligned component styles in `packages/plugin-migration-studio/src/html/styles.ts`.
- Keep existing migration studio behavior, APIs, and editor logic unchanged.

## Implementation

1. Adopt dashboard-style structure and classes:
   - `content-stack`, `panel`, `panel-accent`, `panel-head`, `cluster-row`, `tab-row`, `tab-btn`.
2. Standardize controls to ui-web button/input patterns:
   - `btn`, `btn-primary`, danger action styling aligned with dashboard tokens.
3. Align spacing and typography:
   - remove custom one-off typography drift and match dashboard scale.
4. Align sidebar/context visual patterns:
   - consistent chips, rows, hover states, borders, and surfaces.
5. Preserve IDs and JS hooks so functionality remains intact.

## Validation

- Build `@sbtools/ui-web`.
- Build `@sbtools/plugin-migration-studio`.
- Verify no regressions in DOM IDs used by studio scripts.

