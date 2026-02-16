# @sbtools/plugin-frontend-usage

Plugin for supabase-tools that scans frontend code for Supabase SDK usage. Lives at `supabase-tools/packages/plugin-frontend-usage/`.

## When to Use

Use this plugin when the user needs to:
- See which frontend components use which Supabase tables/RPCs/auth/storage
- Audit Supabase usage across the codebase
- Generate a report of frontend–backend coupling
- Integrate frontend usage into the Backend Atlas

## CLI Commands

- `sbt frontend-usage` — Scan configured paths, generate `docs/frontend-usage.html`, open in browser
- `sbt frontend-usage --json` — Output raw JSON to stdout
- `sbt frontend-usage --no-open` — Skip auto-opening the report

## Configuration

- `scanPaths` — Directories to scan (default: `["src/"]`)

## File Layout

```
plugin-frontend-usage/
├── src/
│   ├── index.ts         # SbtPlugin: frontend-usage command + hooks
│   ├── atlas.ts         # Atlas UI via buildAtlasUI() — frontend usage section
│   ├── scanner.ts       # File discovery, line-by-line scan
│   ├── patterns.ts      # Regex patterns, UsageHit, FrontendUsageData
│   ├── analyzer.ts      # Aggregation
│   ├── html-generator.ts # Self-contained HTML (dark theme)
│   └── atlas/
│       └── styles.ts    # Additional CSS for Atlas cards
├── package.json
└── SKILL.md
```
