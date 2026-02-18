# @sbtools/ui-web

Shared UI package for supabase-tools — SSR page renderers and the Vite-built React dashboard SPA.

## Installation

```bash
npm install @sbtools/ui-web
```

## What's Included

### SSR Renderers

Server-side page renderers used by plugin CLI commands to generate standalone HTML files:

- `renderDepgraphPage` — Interactive dependency graph (`sbt depgraph --html`)
- `renderFrontendUsagePage` — Frontend SDK usage report (`sbt frontend-usage`)
- `renderMigrationAuditPage` — Migration audit report (`sbt migration-audit`)
- `renderMigrationDetailPage` — Per-migration detail pages
- `renderLogsViewerPage` — Live log viewer (`sbt logs viewer`)
- `renderMigrationStudioPage` — Migration authoring UI (`sbt migration-studio`)
- `renderRawDocument` — Base HTML document shell

### Dashboard SPA

A Vite-built React single-page application served by `sbt dashboard`:

- App shell with sidebar navigation and dark mode toggle
- Shared components: StatCard, Badge, SearchInput, CodeBlock, DataTable, CardGrid, GenericSection
- Plugin-driven pages rendered from `DashboardSectionDef` JSON config
- Design tokens with automatic light/dark mode (`tokens.css`)

The dashboard is bundled into `@sbtools/core` during build — consumers don't need to install this package directly.

## Usage

```ts
import { renderDepgraphPage, renderRawDocument } from "@sbtools/ui-web";
```

## Development

To run the dashboard SPA with Vite HMR:

1. **Start the dashboard backend** (serves API and static assets on port 3400):

   ```bash
   sbt dashboard
   ```

2. **Generate atlas data** (required for `/api/atlas-data`):

   ```bash
   sbt generate-atlas
   ```

3. **Run Vite dev server** with API proxy:

   ```bash
   npm run dev
   ```

   Or from repo root: `npm run dashboard:dev`

   The UI runs at `http://localhost:5173`. API calls to `/api/*` are proxied to the backend at `http://127.0.0.1:3400`.

   Set `DASHBOARD_API_PORT` if the backend runs on a different port.

## Dependencies

- `react`, `react-dom` — Used for `renderToStaticMarkup` in SSR renderers
- `vite`, `@vitejs/plugin-react` — Dev dependencies for dashboard build
