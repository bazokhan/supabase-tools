---
description: Document Supabase Edge Functions by statically analysing TypeScript source files.
---

# @sbtools/plugin-deno-functions

[![npm](https://img.shields.io/npm/v/@sbtools/plugin-deno-functions.svg)](https://www.npmjs.com/package/@sbtools/plugin-deno-functions)

Plugin that documents Supabase Edge Functions by statically analysing TypeScript source files.

## Quick Start

```bash
npm install @sbtools/plugin-deno-functions
```

Add to config:

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

```bash
npx sbt edge-functions
```

## Commands

| Command | Description |
|---------|-------------|
| `edge-functions` | List discovered edge functions |
| `edge-functions --brief` | Summary table only |
| `edge-functions --json` | Output raw JSON |
| `edge-functions --openapi` | Generate OpenAPI spec |

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `baseUrl` | `/functions/v1` | URL prefix for edge function endpoints |
| `configTomlPath` | `supabase/config.toml` | Path to Supabase config.toml |

## Integration

Results integrate into Backend Atlas, Swagger UI/ReDoc, and `sbt status`.
