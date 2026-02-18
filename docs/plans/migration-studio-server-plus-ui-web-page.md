# Migration Studio as Server + ui-web Page

## Goal

Make `@sbtools/plugin-migration-studio` server-only, and move the full Migration Studio UI into `@sbtools/ui-web` as a normal dashboard page (same model as other plugin pages).

## Product Behavior

1. Migration Studio plugin remains responsible for:
   - command lifecycle (`sbt migration-studio`)
   - HTTP APIs (`/api/schema`, `/api/templates`, `/api/migrations`, `/api/migration/:file`, `/api/analyze`, `/api/validate`, `/api/save`, `/api/apply`, `/api/events`)
2. Dashboard gets a first-class Migration Studio page in React.
3. Page is shown only when plugin is active.
4. Page connects to studio server over HTTP (default `http://localhost:3335`, configurable in dashboard settings later if needed).
5. If server is not running, page shows a clear empty/error state with quick start instructions.

## Architecture Changes

### A) `@sbtools/plugin-migration-studio`

- Remove HTML page generation responsibility from plugin runtime path.
- Keep server route handlers only.
- Keep CodeMirror/lib serving endpoints only if still needed by server-side clients; otherwise remove once UI bundles dependencies directly.
- Keep all existing API contracts backward compatible.

### B) `@sbtools/ui-web`

- Add a new dashboard page: `MigrationStudio` (React).
- Integrate with existing dashboard routing/nav and plugin availability model.
- Implement hooks for studio server APIs:
  - `useStudioStatus` (ping/check health)
  - `useStudioSchema`, `useStudioTemplates`, `useStudioMigrations`
  - action hooks for analyze/validate/save/apply
  - SSE hook for `/api/events`
- Use existing dashboard components/styles (`panel`, `tab-row`, `AppDataTable`, `StatCard`, `CodeBlock`, etc.) for full visual parity.
- Embed CodeMirror in React page (client-side only, no plugin HTML renderer).

### C) `@sbtools/core` / dashboard integration

- Ensure plugin availability includes migration studio (same way other pages are toggled).
- Add route/page entry and nav item (likely near Migrations).

## Data/API Compatibility

- API endpoints remain the same to avoid breaking existing external tooling.
- UI should tolerate absent endpoints and return actionable messages.
- No change to migration artifact format in this phase.

## UX Flow

1. Open dashboard -> Migration Studio page.
2. If studio server reachable:
   - load schema/templates/migrations
   - show editor, analysis panel, context lists
   - enable save/apply/analyze/validate actions
3. If not reachable:
   - show status card with command hint:
     - `sbt migration-studio --port 3335`
   - optional retry button.

## Implementation Steps

1. Add Migration Studio page skeleton and route in `ui-web`.
2. Add server-API hooks and typed client functions.
3. Port current studio UI/logic from imperative script to React page state/actions.
4. Wire CodeMirror setup in React component lifecycle.
5. Add SSE refresh behavior in React.
6. Remove/retire plugin HTML page renderer coupling.
7. Update docs and changesets.

## Validation

- `npm run build -w packages/ui-web`
- `npm run build -w packages/plugin-migration-studio`
- manual sanity:
  - plugin active + server running => full page works
  - plugin active + server down => graceful fallback
  - plugin inactive => no page/disabled state

## Out of Scope (this phase)

- Multi-server profile management UI.
- Authentication/TLS for studio server.
- API contract redesign.

