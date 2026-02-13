---
description: Start API documentation services — Swagger UI, ReDoc, Backend Atlas, SchemaSpy via Docker Compose.
---

# @sbtools/plugin-docs-server

[![npm](https://img.shields.io/npm/v/@sbtools/plugin-docs-server.svg)](https://www.npmjs.com/package/@sbtools/plugin-docs-server)

Plugin that starts API documentation services via Docker Compose: Swagger UI, ReDoc, Backend Atlas, and SchemaSpy. Subcommands let you start only the services you need.

## Quick Start

```bash
npm install @sbtools/plugin-docs-server
```

Add to config: `{ "path": "@sbtools/plugin-docs-server" }`

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

Uses `api.url` and Docker compose from @sbtools/core. Fetches OpenAPI spec from the running REST API.
