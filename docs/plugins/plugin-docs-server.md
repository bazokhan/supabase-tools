# @sbtools/plugin-docs-server

Plugin that starts API documentation services: Swagger UI, ReDoc, and Backend Atlas via Docker Compose.

## Quick Start

```bash
npm install @sbtools/plugin-docs-server
```

Add to config: `{ "path": "@sbtools/plugin-docs-server" }`

```bash
# Start documentation services (part of `sbt docs`)
npx sbt start-docs-server

# Stop
npx sbt start-docs-server stop
```

## Commands

| Command | Description |
|---------|-------------|
| `start-docs-server` | Start Swagger UI, ReDoc, Atlas |
| `start-docs-server stop` | Stop all documentation containers |

## Configuration

Uses `api.url` and Docker compose from @sbtools/core. Fetches OpenAPI spec from the running REST API.
