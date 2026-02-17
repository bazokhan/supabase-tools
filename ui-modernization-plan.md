# UI Modernization Plan — Complete

All phases are implemented. This file documents what was done for future reference.

## Phase 1: New Plugin Contract (`getDashboardView`)

- Added `getDashboardView()` hook and all `Dashboard*` types to `packages/sdk/src/plugin-api.ts`
- Types are fully JSON-serializable (no JS strings): `DashboardSectionDef`, `DashboardStatDef`, `DashboardCardDef`, `DashboardTableDef`, `DashboardBadgeDef`, `DashboardDetailDef`, `DashboardView`, `DashboardTone`, `DashboardFieldFormat`, `DashboardSectionLayout`
- Added `itemsPath` and `itemsStartIndex` for nested/sliced arrays
- Exported all types from `packages/sdk/src/index.ts`

## Phase 2: Design System

- Created `packages/ui-web/src/styles/tokens.css` with CSS custom properties and `Inter` + `JetBrains Mono` font stack
- Light/dark mode via `@media (prefers-color-scheme: dark)` plus `.dark` toggle class
- Updated `packages/ui-web/src/components/document.tsx` to use tokens

## Phase 3: Vite React SPA

- Vite config at `packages/ui-web/vite.config.ts`, outputs to `dist/dashboard/`
- Entry: `packages/ui-web/src/dashboard/main.tsx` + `index.html`
- App shell (`App.tsx`) with sidebar navigation, dark mode toggle
- Shared components: `StatCard`, `Badge`, `SearchInput`, `CodeBlock`, `DataTable`, `CardGrid`, `ExpandableCard`, `GenericSection`
- Field resolver (`lib/field-resolver.ts`) resolves dot-path strings to values for plugin-driven content
- Pages: `Overview`, `Migrations`, `Depgraph`, `Logs`, `FrontendUsage`
- Hooks: `useAtlasData`, `useDashboardConfig`

## Phase 4: Dashboard Server

- `sbt dashboard` command at `packages/core/src/commands/dashboard.ts` (default port 3400)
- API routes: `/api/atlas-data`, `/api/dashboard-config`, `/api/services`, `/api/events` (SSE)
- Built-in `CORE_SECTIONS` for functions, policies, triggers, views, materialized views, types, enums
- Collects `getDashboardView()` from all plugins and merges sections
- Dashboard assets copied into core during build via `scripts/copy-dashboard.ts`

## Phase 5: Remove Legacy Atlas UI Code

Removed the old `getAtlasView()` → `buildAtlasUI()` → string-generated JS pipeline:

- **SDK**: Deleted `atlas-ui.ts`, `atlas-ui.test.ts`; removed `PluginAtlasView`, `getAtlasView`, `buildAtlasUI`, `Atlas*` exports from `plugin-api.ts` and `index.ts`
- **Core**: Deleted `atlas-html.ts` and entire `src/atlas/` (12 files); removed registration, preflight, help, docs `atlas` subcommand
- **Plugins**: Deleted `atlas.ts` and `atlas/styles.ts` from depgraph, frontend-usage, logs, migration-audit, deno-functions; removed `getAtlasView` from each `index.ts`
- **Docs**: Updated writing-plugins, sdk/index, plugin-atlas-html (redirect to dashboard), implicit-file-contracts
- **Lint/Scaffold**: Replaced R4 with `dashboard-use-hook`, R9 with `no-atlas-leftovers`; removed `getAtlasView` from scaffold template and help text
- **SKILL files**: Updated root and all plugin SKILL.md files

## Phase 6: Plugin Migration to `getDashboardView()`

All 5 plugins implement `getDashboardView()`:
- `packages/plugin-depgraph/src/dashboard.ts`
- `packages/plugin-frontend-usage/src/dashboard.ts`
- `packages/plugin-logs/src/dashboard.ts`
- `packages/plugin-migration-audit/src/dashboard.ts`
- `packages/plugin-deno-functions/src/dashboard.ts`

## Build Integration

- Root build: `npm run build -w packages/sdk && npm run build -w packages/ui-web && npm run build --workspaces && tsx scripts/copy-dashboard.ts`
- `scripts/copy-dashboard.ts` (root scripts folder, TypeScript) copies `packages/ui-web/dist/dashboard/` → `packages/core/dist/dashboard/`
- Published `@sbtools/core` includes the dashboard bundle — consumers don't need `ui-web`

## Not Dead Code

These power standalone HTML outputs from plugin CLI commands (`sbt depgraph --html`, `sbt migration-audit`, `sbt frontend-usage`, `sbt logs viewer`):

- `packages/ui-web/src/renderers/` — SSR page renderers
- `packages/ui-web/src/components/document.tsx` — shared HTML document shell
- Plugin `html-generator.ts` / `viewer-html.ts` / `detail-generator.ts` files
- `packages/ui-web/src/index.ts` — SSR renderer exports
