# @sbtools/plugin-docs-server

Plugin for [supabase-tools](https://github.com/supabase/supabase) that starts API documentation services: Swagger UI, ReDoc, and Backend Atlas via Docker Compose.

## Quick Start

```bash
# Start documentation services
npm run sbt -- start-docs-server

# Stop
npm run sbt -- start-docs-server stop
```

## Commands

| Command | Description |
|---------|-------------|
| `start-docs-server` | Start Swagger UI, ReDoc, and Atlas on configured ports |
| `start-docs-server stop` | Stop all documentation containers |

## Configuration

Uses `api.url` and Docker compose files from supabase-tools. Fetches OpenAPI spec from the running REST API.

## Project Structure

```
packages/plugin-docs-server/
├── src/
│   └── index.ts   # Plugin entry, start-docs-server command
├── package.json
├── tsconfig.json
└── README.md
```
