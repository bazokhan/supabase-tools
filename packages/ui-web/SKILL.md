# @sbtools/ui-web

## Purpose

Shared UI package providing SSR page renderers for plugin CLI commands and the Vite-built React dashboard SPA.

## When to Use

Use this skill when the user needs to:
- Modify the dashboard SPA (pages, components, hooks, styles)
- Update SSR renderers for standalone HTML outputs
- Change the design token system (colors, fonts, spacing)
- Add new dashboard pages or components

## Architecture

Two separate outputs from one package:

1. **SSR renderers** (`src/renderers/`) — compiled by `tsc`, exported from `src/index.ts`, consumed by plugins at build time
2. **Dashboard SPA** (`src/dashboard/`) — compiled by Vite, outputs to `dist/dashboard/`, copied into `@sbtools/core` during root build

The dashboard `tsconfig.json` excludes `src/dashboard/` so `tsc` only compiles SSR code. Vite handles the dashboard separately.

## File Layout

```
ui-web/
├── src/
│   ├── index.ts               # SSR renderer exports
│   ├── components/
│   │   └── document.tsx        # Shared HTML document shell (SSR)
│   ├── renderers/
│   │   ├── depgraph.tsx        # Dependency graph page
│   │   ├── frontend-usage.tsx  # Frontend usage report
│   │   ├── migration-audit.tsx # Migration audit report
│   │   ├── migration-detail.tsx # Per-migration detail
│   │   ├── logs-viewer.tsx     # Live log viewer
│   │   └── migration-studio.ts # Migration studio editor
│   ├── styles/
│   │   └── tokens.css          # Design tokens (light/dark mode)
│   └── dashboard/
│       ├── index.html          # Vite entry HTML
│       ├── main.tsx            # React entry point
│       ├── App.tsx             # App shell with sidebar + routing
│       ├── components/         # StatCard, Badge, DataTable, CardGrid, etc.
│       ├── pages/              # Overview, Migrations, Depgraph, Logs, FrontendUsage
│       ├── hooks/              # useAtlasData, useDashboardConfig
│       └── lib/
│           └── field-resolver.ts # Dot-path field resolution for plugin configs
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Design Tokens

`src/styles/tokens.css` defines CSS custom properties for colors, fonts, spacing. Supports automatic dark mode via `@media (prefers-color-scheme: dark)` and manual toggle via `.dark` class on `<html>`.

Font stack: Inter (body), JetBrains Mono (code).

## Dashboard Data Flow

1. `sbt dashboard` serves the SPA and APIs from `@sbtools/core`
2. SPA fetches `/api/atlas-data` (atlas JSON) and `/api/dashboard-config` (merged `DashboardSectionDef[]`)
3. `GenericSection` component renders any section from plugin JSON config using the field resolver
4. Pages compose `GenericSection` with custom layouts and filtering
