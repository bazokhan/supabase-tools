# Dashboard First-Run Ops UX

## Goal

Make the dashboard useful immediately after installing `@sbtools/core` in a new project by:

1. Keeping Migration Studio usable even when `/api/atlas-data` is missing (404).
2. Adding in-dashboard plugin management (discover, install guidance, add/enable/disable/remove).
3. Making the Commands page status-aware (plugin installed/enabled, service running, already-running command).
4. Exposing links/status for related local UIs (Supabase Studio, Swagger docs, plugin UIs when available).

## Current Problems (Observed)

1. `App.tsx` blocks most routes when `useAtlasData()` errors, so fresh projects show a generic setup panel instead of usable pages.
2. Plugin lifecycle is CLI-only (`sbt plugin ...`), with no dashboard entry point.
3. Runner command cards are static and can trigger commands that are not actionable in current state.
4. Header route actions are hardcoded and do not reflect runtime status of services/UIs.

## Proposed Solution

### 1) Decouple route rendering from atlas availability

- Keep atlas fetch for pages that need snapshot categories.
- Allow operational routes (`/migration-studio`, `/runner`, new `/plugins`, new `/services`) to render without atlas.
- Replace global atlas-error gate with route-level fallback states.
- Preserve existing “Getting Started” panel for data-driven pages (Overview/Details/etc.) when atlas is unavailable.

### 2) Add plugin management API in core dashboard server

- Add read endpoint: `GET /api/plugins` returning:
  - built-in plugin catalog (name, description)
  - configured plugins from `supabase-tools.config.json`
  - computed status per plugin: `configured`, `enabled`, `installed` (resolvable), `loaded`.
- Add write endpoint: `POST /api/plugins` with actions:
  - `add`, `remove`, `enable`, `disable`.
- Keep writes as config-file edits only (same behavior as `sbt plugin` command); return clear install guidance for missing npm package.
- Reuse shared plugin catalog constant between CLI `plugin.ts` and dashboard route to avoid drift.

### 3) Add Plugins page in ui-web

- New route/nav item: `Plugins`.
- Page capabilities:
  - list built-in + configured custom plugins
  - filter by status (enabled/disabled/not configured/not installed)
  - action buttons for add/enable/disable/remove via new API
  - “install command” copy hint for npm packages not installed
  - refresh status after actions.
- Integrate with existing visual language (`panel`, `Badge`, `AppDataTable`/cards).

### 4) Make Commands page context-aware

- Extend `GET /api/commands` payload with metadata per command:
  - `requiresPlugins` (if applicable)
  - `requiresServices` (if applicable, e.g. docker/db)
  - `longRunning` and `singleton` hints.
- Maintain server-side process registry for commands launched from dashboard:
  - expose running state (`running`, `pid`, start time)
  - prevent duplicate starts for singleton commands (return 409 with message).
- In Runner UI:
  - disable Run when prerequisites missing
  - show reason badges/tooltips (“plugin not enabled”, “service not running”, “already running”)
  - swap Run button to “View running” or “Restart” where appropriate.

### 5) Add Services/UIs visibility panel

- Add new API endpoint (or extend `/api/services`) to include:
  - service container status (existing behavior)
  - known UI endpoints with health probe result:
    - Supabase Studio (`http://localhost:54323` typical)
    - Swagger/OpenAPI docs endpoint(s) if generated/served
    - Migration Studio server URL
    - plugin HTML pages when files exist.
- Add dashboard page (or topbar dropdown enhancement) listing these UIs with:
  - reachable/unreachable status
  - open-link actions.

## File-Level Implementation Plan

1. Core API and shared metadata
   - `packages/core/src/commands/dashboard.ts`
   - `packages/core/src/commands/plugin.ts`
   - (new) shared plugin catalog module under `packages/core/src/commands/` or `packages/core/src/lib/`

2. Dashboard model and routing
   - `packages/ui-web/src/dashboard/lib/model.ts`
   - `packages/ui-web/src/dashboard/App.tsx`
   - `packages/ui-web/src/dashboard/lib/section-icons.tsx` (if new nav icon needed)

3. New hooks/pages
   - (new) `packages/ui-web/src/dashboard/hooks/usePlugins.ts`
   - (new) `packages/ui-web/src/dashboard/hooks/useServices.ts`
   - (new) `packages/ui-web/src/dashboard/pages/Plugins.tsx`
   - (new) `packages/ui-web/src/dashboard/pages/Services.tsx` (or equivalent integrated panel)
   - update `packages/ui-web/src/dashboard/pages/Runner.tsx`
   - update `packages/ui-web/src/dashboard/hooks/useCommands.ts`

4. Styling
   - `packages/ui-web/src/dashboard/styles.css` (or existing dashboard stylesheet file in package)

5. Docs and release metadata
   - `CLAUDE.md` and `AGENTS.md` `## Codebase Architecture` updates for new pages/routes/API endpoints
   - `.changeset/*.md` for `@sbtools/core` and `@sbtools/ui-web`

## Validation Plan

1. Build
   - `npm run build -w packages/core`
   - `npm run build -w packages/ui-web`

2. First-run scenario (no atlas data)
   - start dashboard in clean project
   - verify `/migration-studio` renders and can interact with studio server
   - verify Plugins page is usable
   - verify data-heavy pages still show actionable setup state

3. Plugin workflow
   - add/enable/disable/remove a plugin via dashboard
   - verify `supabase-tools.config.json` updates correctly
   - verify missing package state shows install guidance

4. Runner behavior
   - verify disabled commands show prerequisite reasons
   - verify duplicate singleton launch protection
   - verify running state survives UI refresh while dashboard process is alive

5. Services/UIs
   - verify links and reachability status for known local UIs
   - verify graceful behavior when endpoints are down

## Risks and Mitigations

1. Risk: hardcoding command prerequisites becomes stale.
   - Mitigation: define a central command metadata map in core and keep conservative defaults.
2. Risk: plugin “installed” detection can be noisy across workspaces.
   - Mitigation: resolve from project root with explicit status (`unknown` fallback) and actionable messaging.
3. Risk: process registry edge cases for long-running commands.
   - Mitigation: track child exit/close robustly and auto-clean stale entries.

## Out of Scope

1. Auto-running `npm install` from the dashboard.
2. Full plugin marketplace/registry integration.
3. Authenticated remote command execution; scope remains local dev environment.
