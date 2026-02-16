---
description: docs command (built into core) — Swagger UI, ReDoc, Backend Atlas, SchemaSpy.
---

# docs command (Built-in)

The `docs` command is **built into @sbtools/core** — no plugin installation required. It starts API documentation services via Docker Compose: Swagger UI, ReDoc, Backend Atlas, and SchemaSpy.

> Previously provided by `@sbtools/plugin-docs-server`, which has been merged into core. Remove it from your config if present.

## Usage

```bash
npx sbt docs              # All services
npx sbt docs swagger      # Swagger UI only
npx sbt docs stop         # Stop all docs containers
```

## Commands

| Command | Description |
|---------|-------------|
| `docs` or `docs all` | Start all documentation services |
| `docs swagger` | Swagger UI (port 8081) |
| `docs redoc` | ReDoc (port 8082) |
| `docs atlas` | Backend Atlas (port 8083/atlas/) |
| `docs schemaspy` | SchemaSpy (port 8083/schemaspy/) |
| `docs stop` | Stop all documentation containers |

## Prerequisites by Subcommand

| Subcommand | Needs |
|------------|-------|
| `docs swagger` / `docs redoc` | Docker, compose files; OpenAPI spec auto-fetched or placeholder |
| `docs atlas` | `backend-atlas-data.json` and `backend-atlas.html` (run `sbt generate-atlas` then `sbt atlas-html` first) |
| `docs schemaspy` | Docker, DB running |
| `docs all` | All of the above |

## Full Sequence for All Docs

1. `sbt start`
2. `sbt snapshot`
3. `sbt generate-atlas`
4. `sbt atlas-html`
5. `sbt generate-erd`
6. `sbt docs all`

## Configuration

Uses `api.url` and Docker compose from @sbtools/core. Fetches OpenAPI spec from the running REST API. Merges OpenAPI contributions from plugins (e.g. edge functions) when available.
