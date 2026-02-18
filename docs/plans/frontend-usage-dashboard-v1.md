# Frontend Usage Dashboard v1 Improvements

## Goal

Make the Frontend Usage dashboard page actionable by adding:

1. Summary cards for key usage signals.
2. Resource-type filtering.
3. Hot-components ranking.
4. Resource-centric view (`resource -> components`).

## Scope

- Update `packages/ui-web/src/dashboard/pages/FrontendUsage.tsx`.
- Reuse existing dashboard components and styles.
- No scanner/parser changes in this iteration.

## Implementation

1. Keep existing component table (`component`, `hitCount`, `resources`) as one section.
2. Add computed aggregates from existing atlas category rows:
   - Total components.
   - Total unique resources.
   - Components touching `auth`.
   - Components touching `storage`.
3. Add type filter chips using existing `tab-btn` style and apply to both component and resource-centric sections.
4. Add “Hot Components” panel:
   - Rank by weighted score from `hitCount` and distinct resource types.
5. Add “Resource Impact Map” table:
   - Rows contain `resource`, `type`, `components`, `componentCount`, `totalHits`.

## Validation

- Build `@sbtools/ui-web` successfully.
- Confirm filters update all sections consistently.

