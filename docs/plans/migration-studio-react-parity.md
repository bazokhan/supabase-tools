# Migration Studio React Parity Plan

## Goal

Make `sbt migration-studio` UI React-based and visually/behaviorally aligned with the dashboard (`@sbtools/ui-web`).

## Why this is needed

Current Migration Studio is server-rendered HTML + imperative DOM scripting. It can imitate styles, but it is not a React UI and cannot reliably stay in lockstep with dashboard component behavior.

## Scope

- Build a dedicated React app for Migration Studio under `@sbtools/ui-web`.
- Serve the built app from `@sbtools/plugin-migration-studio` server.
- Keep all existing studio APIs (`/api/schema`, `/api/templates`, `/api/migrations`, `/api/migration/:file`, `/api/analyze`, `/api/validate`, `/api/save`, `/api/apply`, `/api/events`) intact.
- Preserve feature parity (editor, analysis, templates, context, save/apply flow).

## Architecture Changes

1. `@sbtools/ui-web`
   - Add a new Vite entry for migration studio app (`src/migration-studio/main.tsx` + components/hooks).
   - Reuse dashboard tokens and shared component classes for exact look/behavior parity.
   - Output bundle to `dist/migration-studio/`.

2. `@sbtools/plugin-migration-studio`
   - Stop generating large inline HTML/JS for editor page.
   - Serve `dist/migration-studio/index.html` and static assets.
   - Keep existing `/lib/*` codemirror module serving for browser imports if still required; otherwise move to bundled dependencies.
   - Keep existing API route handlers unchanged and consumed by React app.

3. `@sbtools/ui-web` renderer API
   - Replace `renderMigrationStudioPage` implementation with minimal HTML shell (or remove usage) pointing to migration-studio bundle.

## Implementation Steps

1. Create migration-studio React app shell in `@sbtools/ui-web`.
2. Port state/actions from current inline script into React hooks/components:
   - Editor initialization (CodeMirror)
   - Schema loading + status
   - Live analysis + validation
   - Template insertion
   - Context tabs/migration list/schema list
   - Save/save-new/apply flows
   - SSE refresh handling
3. Reuse existing ui-web design tokens + dashboard layout patterns.
4. Update plugin server static file resolution to serve built migration-studio assets.
5. Keep route contracts stable for compatibility.
6. Update docs (`plugin-migration-studio` README and relevant docs).
7. Add changeset entries for both packages.

## Acceptance Criteria

- Migration Studio UI is rendered by React.
- Look/feel matches dashboard visual system.
- Existing studio workflows behave the same or better.
- `npm run build -w packages/ui-web` and `npm run build -w packages/plugin-migration-studio` pass.

