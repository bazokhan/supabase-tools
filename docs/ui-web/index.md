---
description: "@sbtools/ui-web — Shared React UI package: SSR renderers for standalone HTML reports and the Vite React dashboard SPA."
---

# @sbtools/ui-web

[![npm](https://img.shields.io/npm/v/@sbtools/ui-web.svg)](https://www.npmjs.com/package/@sbtools/ui-web)

Shared UI package for supabase-tools. Provides two main things:

1. **SSR renderers** — Node.js functions that generate standalone HTML files for plugin CLI commands
2. **React dashboard SPA** — Vite-built single-page app served by `sbt dashboard` (port 3400)

The dashboard is bundled into `@sbtools/core` at build time — end users do not need to install this package directly. It is primarily a dependency for plugins that generate standalone HTML pages.

## Installation

```bash
npm install @sbtools/ui-web
```

## SSR Renderers

Server-side page renderers used by plugin CLI commands to produce standalone HTML reports:

| Export | Used by |
|--------|---------|
| `renderDepgraphPage` | `sbt depgraph --html` |
| `renderFrontendUsagePage` | `sbt frontend-usage` |
| `renderMigrationAuditPage` | `sbt migration-audit --html` |
| `renderMigrationDetailPage` | Per-migration detail pages from `migration-audit` |
| `renderLogsViewerPage` | `sbt logs viewer` |
| `renderMigrationStudioPage` | `sbt migration-studio` (legacy standalone page) |
| `renderRawDocument` | Base HTML document shell — used by all above |

### Usage

```ts
import { renderDepgraphPage, renderRawDocument } from "@sbtools/ui-web";
```

All renderers accept typed data objects and return an HTML string. Write it to a file with `writeFileInDir` from `@sbtools/sdk`.

### Shared Tokens

CSS design tokens are exported for use in SSR pages and plugin renderers:

```ts
import { SHARED_TOKENS_CSS, SHARED_TOKENS_DARK } from "@sbtools/ui-web";
```

These provide the same light/dark mode CSS custom properties used by the dashboard SPA, ensuring visual consistency between standalone HTML reports and the dashboard.

## React Dashboard SPA

The dashboard SPA at `sbt dashboard` (http://localhost:3400) is a Vite-built React application. It includes:

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Overview | `/` | Entity stats, mini charts, clickable filter tabs |
| Details | `/details/:section/:id` | Node detail view with metadata grid, edge tables |
| Migrations | `/migrations` | Migration list, audit status, embedded/pop-out Studio |
| Migration Studio | `/migration-studio` | React dashboard page for Migration Studio (connects to `sbt migration-studio` server) |
| Dependency Graph | `/depgraph` | Interactive graph with focus depth, palette, filters |
| ERD | `/erd` | Mermaid ERD diagrams per table with search and raw toggle |
| Frontend Usage | `/frontend-usage` | Filter-driven SDK usage views: hot components, component map, resource impact |
| Logs | `/logs` | Live Docker log stream with service filters and inline search |
| Commands | `/commands` | Run any `sbt` command from the browser with live streaming output |
| Not Found | `*` | 404 fallback |

### Shared Components

- `StatCard` — Clickable stat cards with tone, used on Overview
- `Badge` — Status/type badges with tone map support
- `DataTable` / `AppDataTable` — Sortable, paginated tables with column resize
- `CardGrid` / `GenericSection` — Plugin-driven section renderers
- `SearchInput` — Global search with Ctrl+K hotkey, arrow navigation
- `CodeBlock` — Syntax-highlighted code viewer
- `ValueRenderer` — Collapsible JSON tree, SQL highlighting, auto-detection
- `EmptyState` — Unified empty state
- `Dropdown` — Multi-action button menus
- `MiniBarChart` / `MiniDonutChart` — Inline charts (Recharts)
- `MermaidRenderer` — Renders Mermaid diagrams as SVG

### Design System

All colors, spacing, and typography use CSS custom properties from `tokens.css`. Light/dark mode is supported via `[data-theme="dark"]`. Fonts are Geist + Geist Mono (loaded from Fontsource).

### Dashboard API routes (served by `sbt dashboard`)

| Route | Returns |
|-------|---------|
| `GET /api/atlas-data` | `backend-atlas-data.json` |
| `GET /api/dashboard-config` | Plugin-contributed section definitions |
| `GET /api/commands` | All registered commands with category |
| `GET /api/run/stream?command=...` | SSE: stream `sbt <command>` output |
| `GET /api/logs/services` | Docker service statuses |
| `GET /api/logs/stream?services=...` | Live SSE Docker log stream |
| `GET /api/fs/list?scope=...&path=...` | Safe file listing |
| `GET /api/fs/file?scope=...&path=...` | Safe file content |

## Development

To run the dashboard SPA with Vite HMR during development:

```bash
# 1. Start the backend (serves API on port 3400)
sbt dashboard

# 2. Generate atlas data (required for /api/atlas-data)
sbt generate-atlas

# 3. Start Vite dev server (proxies /api/* to port 3400)
npm run dev           # from packages/ui-web/
# or
npm run dashboard:dev # from repo root
```

The UI runs at `http://localhost:5173`. Set `DASHBOARD_API_PORT` if the backend uses a different port.

## Dependencies

| Dependency | Purpose |
|------------|---------|
| `react`, `react-dom` | SSR (`renderToStaticMarkup`) and dashboard SPA |
| `mermaid` | ERD diagram rendering |
| `recharts` | Mini bar/donut charts |
| `@codemirror/*` | SQL editor in Migration Studio page |
| `lucide-react` | Icon set |
| `vite`, `@vitejs/plugin-react` | Dashboard SPA build (devDependencies) |
