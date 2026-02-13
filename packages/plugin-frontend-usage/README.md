# @sbtools/plugin-frontend-usage

Plugin for [supabase-tools](../../) that scans frontend `.ts/.tsx/.js/.jsx` files for Supabase SDK usage (table queries, RPCs, auth, storage, edge functions, REST calls) and generates an interactive HTML report + integrates with Backend Atlas.

## Quick Start

```bash
# 1. Add to supabase-tools.config.json
# 2. Run
npx tsx supabase-tools/cli.ts frontend-usage
# → docs/frontend-usage.html
```

## Commands

| Command | Description |
|---------|-------------|
| `frontend-usage` | Scan src/, generate HTML report, open in browser |
| `frontend-usage --json` | Output raw JSON to stdout |
| `frontend-usage --no-open` | Skip opening the report |
| `frontend-usage --help` | Show all options |

## Patterns Detected

| Pattern | Resource Type | Example |
|---------|---------------|---------|
| `.from("table")` | table | `supabase.from("papers")` |
| `.rpc("fn")` | rpc | `supabase.rpc("get_stats")` |
| `.auth.signIn*` etc. | auth | `supabase.auth.signInWithPassword(...)` |
| `.storage.from("bucket")` | storage | `supabase.storage.from("avatars")` |
| `.functions.invoke("name")` | edge_function | `supabase.functions.invoke("process")` |
| `fetch(".../rest/v1/...")` | rest_api | `fetch("/rest/v1/papers")` |
| `fetch(".../functions/v1/...")` | edge_function | `fetch("/functions/v1/hello")` |

## Configuration

```json
{
  "plugins": [
    {
      "path": "@sbtools/plugin-frontend-usage",
      "config": {
        "scanPaths": ["src/"]
      }
    }
  ]
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `scanPaths` | `["src/"]` | Directories to scan for frontend files |

## Dependencies

| Type | Requirement |
|------|-------------|
| Files | Scan paths (default `src/`) must exist |

No Docker or database required.

## Atlas Integration

- **getAtlasData()**: Component → resource mapping as `frontend_usage` category
- **getAtlasUI()**: Section HTML, card renderer, styles
- **getStatusLines()**: Summary line in `sbt status`

## Project Structure

```
plugin-frontend-usage/
├── index.ts
├── src/
│   ├── index.ts       # SbtPlugin
│   ├── scanner.ts     # File discovery + scanning
│   ├── patterns.ts    # Regex patterns
│   ├── analyzer.ts    # Aggregation
│   ├── html-generator.ts
│   └── atlas/
│       ├── cards.ts
│       ├── sections.ts
│       └── styles.ts
├── package.json
├── tsconfig.json
├── README.md
└── SKILL.md
```
