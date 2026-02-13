# @sbtools/plugin-docs-server

Plugin for [supabase-tools](https://github.com/supabase/supabase) that starts API documentation services: Swagger UI, ReDoc, Backend Atlas, and SchemaSpy via Docker Compose. Supports granular subcommands so you can start only the services you need.

## Quick Start

```bash
# Start all documentation services
npm run sbt -- docs

# Start only Swagger UI
npm run sbt -- docs swagger

# Stop all docs containers
npm run sbt -- docs stop
```

## Commands

| Command | Description |
|---------|-------------|
| `docs` or `docs all` | Start all documentation services |
| `docs swagger` | Swagger UI only (port 8081) |
| `docs redoc` | ReDoc only (port 8082) |
| `docs atlas` | Backend Atlas only (port 8083/atlas/) |
| `docs schemaspy` | SchemaSpy only (port 8083/schemaspy/) |
| `docs stop` | Stop all documentation containers |

## Dependencies

Per-subcommand (only what you run):

| Subcommand | Type | Requirement |
|------------|------|-------------|
| `docs swagger` / `docs redoc` | Docker | Must be running |
| `docs swagger` / `docs redoc` | Files | `docker-compose.api-docs.yml`, `.env` in sbtDataDir |
| `docs atlas` | Files | `backend-atlas-data.json` AND `backend-atlas.html` must exist (run `sbt generate-atlas` + `sbt atlas-html` first) |
| `docs schemaspy` | Docker | Must be running; DB container must be accessible |
| `docs all` | All | All of the above |

## Configuration

Uses `api.url` and Docker compose files from supabase-tools. Fetches OpenAPI spec from the running REST API.

## Project Structure

```
packages/plugin-docs-server/
├── src/
│   └── index.ts   # Plugin entry, docs command with subcommands
├── package.json
├── tsconfig.json
└── README.md
```
