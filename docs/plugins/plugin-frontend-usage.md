# @sbtools/plugin-frontend-usage

Plugin that scans frontend `.ts/.tsx/.js/.jsx` files for Supabase SDK usage and generates an interactive HTML report.

## Quick Start

```bash
npm install @sbtools/plugin-frontend-usage
```

Add to config: `{ "path": "@sbtools/plugin-frontend-usage" }`

```bash
npx sbt frontend-usage
# → docs/frontend-usage.html
```

## Commands

| Command | Description |
|---------|-------------|
| `frontend-usage` | Scan, generate HTML, open in browser |
| `frontend-usage --json` | Output raw JSON |
| `frontend-usage --no-open` | Skip opening report |

## Patterns Detected

Tables (`.from()`), RPCs (`.rpc()`), auth, storage, edge functions, REST calls.

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `scanPaths` | `["src/"]` | Directories to scan |
