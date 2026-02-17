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

## Dependencies

- `react`, `react-dom` — Used for `renderToStaticMarkup` in SSR renderers
- `vite`, `@vitejs/plugin-react` — Dev dependencies for dashboard build
