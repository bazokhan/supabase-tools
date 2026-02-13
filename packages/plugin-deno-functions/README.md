# @sbtools/plugin-deno-functions

Plugin for [supabase-tools](../../) that documents Supabase Edge Functions by statically analysing TypeScript source files. No runtime dependency on the main package — connected only through the plugin contract and `supabase-tools.config.json`.

## Quick Start

```bash
# 1. Install the plugin
npm install @sbtools/plugin-deno-functions
# 2. Register it in supabase-tools.config.json — see "Activation" below
# 3. Run it
npx tsx supabase-tools/cli.ts edge-functions
```

## Activation

Add a `plugins` entry to your `supabase-tools.config.json`:

```json
{
  "plugins": [
    {
      "path": "@sbtools/plugin-deno-functions",
      "config": {
        "baseUrl": "/functions/v1",
        "configTomlPath": "supabase/config.toml"
      }
    }
  ]
}
```

Set `"enabled": false` to disable the plugin without removing the entry.

## Commands

| Command | Description |
|---|---|
| `edge-functions` | List discovered edge functions with metadata |
| `edge-functions --brief` | Summary table only, skip per-function details |
| `edge-functions --json` | Output raw JSON |
| `edge-functions --openapi` | Also generate `docs/edge-functions-openapi.json` |
| `edge-functions --help` | Show all options |

All commands: `npx tsx supabase-tools/cli.ts <command>`

## What It Does

Scans each `{functionsPath}/{name}/index.ts` and extracts via regex:

| Field | Detection method |
|---|---|
| Function name | Directory name |
| HTTP methods | `req.method === 'POST'` patterns |
| Request fields | `const { a, b } = await req.json()` destructuring |
| Response fields | `JSON.stringify({ success, ... })` patterns |
| Environment variables | `Deno.env.get('...')` calls |
| Auth type | `config.toml` verify_jwt + service role key usage |
| CORS | `corsHeaders` pattern detection |
| External APIs | `fetch('https://...')` URL literals |
| DB tables | `.from('table')` supabase client calls |
| Storage buckets | `.storage.from('bucket')` calls |

Results are integrated into:

- **Backend Atlas** — Edge Functions section with cards, badges, curl/SDK examples, and source viewer
- **Swagger UI / ReDoc** — Edge function paths merged into the combined OpenAPI spec
- **`sbt status`** — Edge function endpoints listed alongside service URLs

## Optional metadata.json

Place a `metadata.json` next to `index.ts` in any function directory to override or supplement what static analysis can't infer:

```json
{
  "description": "Extracts text from PDFs stored in Supabase storage",
  "auth": "service_role",
  "request_fields": [
    { "name": "storage_path", "type": "string", "required": true },
    { "name": "paper_id", "type": "string (UUID)", "required": true }
  ]
}
```

## Configuration

| Key | Default | Description |
|---|---|---|
| `baseUrl` | `/functions/v1` | URL prefix for edge function endpoints |
| `configTomlPath` | `supabase/config.toml` | Path to Supabase config.toml (for `verify_jwt` settings) |

## Dependencies

| Type | Requirement |
|------|-------------|
| Files | `supabase/functions` — edge function source directories must exist |

No Docker or database required for listing. OpenAPI generation needs a running API for full spec.

## Requirements

- Node.js 18+
- `supabase-tools/` in the same project (provides the plugin loader)
- No additional dependencies — the plugin is self-contained

## Project Structure

```
your-project/
├── supabase/
│   ├── functions/              # Edge functions scanned by this plugin
│   │   ├── my-function/
│   │   │   ├── index.ts
│   │   │   └── metadata.json   # Optional override
│   │   └── ...
│   └── config.toml             # verify_jwt settings
├── supabase-tools/             # Main toolkit
│   └── packages/plugin-deno-functions/  # This plugin
└── supabase-tools.config.json  # Plugin registered here
```
