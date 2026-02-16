# @sbtools/plugin-deno-functions

Plugin for `supabase-tools` that documents Supabase Edge Functions by statically analysing TypeScript source files. Lives at `supabase-tools/packages/plugin-deno-functions/`.

## When to Use

Use this plugin when the user needs to:
- Document or visualize edge functions in the Backend Atlas
- See edge function endpoints, auth, request/response schemas
- Generate an OpenAPI spec for edge functions
- List edge functions with their metadata from the CLI

## Activation

Add to `supabase-tools.config.json`:

```json
{
  "plugins": [
    {
      "path": "node_modules/@sbtools/plugin-deno-functions",
      "config": {
        "baseUrl": "/functions/v1",
        "configTomlPath": "supabase/config.toml"
      }
    }
  ]
}
```

## CLI Commands

- `sbt edge-functions` — List all discovered edge functions with methods, auth, endpoints, request/response fields, env vars, external APIs, and DB tables.
- `sbt edge-functions --openapi` — Same as above, plus generate `docs/edge-functions-openapi.json`.

## What It Extracts

Static analysis of each `{functionsPath}/{name}/index.ts`:

| Field | How detected |
|-------|-------------|
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

## Optional metadata.json Override

Place a `metadata.json` next to `index.ts` in any function directory to override or supplement static analysis:

```json
{
  "description": "Extracts text from PDFs stored in Supabase storage",
  "auth": "service_role",
  "request_fields": [
    { "name": "storage_path", "type": "string", "required": true },
    { "name": "paper_id", "type": "string (UUID)", "required": true }
  ],
  "response_fields": [
    { "name": "success", "type": "boolean" },
    { "name": "text_length", "type": "number" }
  ]
}
```

## Plugin Configuration

- `baseUrl` — URL prefix for edge function endpoints (default: `/functions/v1`)
- `configTomlPath` — Path to `config.toml` relative to project root (default: `supabase/config.toml`)

## File Layout

```
plugin-deno-functions/
├── index.ts          # Plugin entry point (SbtPlugin default export)
├── src/
│   ├── index.ts      # Plugin implementation
│   ├── extractor.ts  # Static analysis of TypeScript edge functions
│   ├── toml-parser.ts # Minimal TOML parser for config.toml
│   ├── openapi.ts    # OpenAPI 3.0 spec generator
│   └── atlas/
│       ├── cards.ts  # Edge function card renderer (JS string)
│       ├── sections.ts # HTML section stubs
│       └── styles.ts # Method badge CSS
├── package.json
└── SKILL.md
```
