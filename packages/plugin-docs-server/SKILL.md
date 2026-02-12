# @sbt/plugin-docs-server

Plugin that starts API documentation services (Swagger UI, ReDoc, Backend Atlas). Lives in `supabase-tools/packages/plugin-docs-server/`.

## When to Use

Use this plugin when the user needs to:
- Serve interactive API docs
- View Swagger UI or ReDoc for the REST API
- Run the Backend Atlas in a served environment

## CLI Commands

- `sbt start-docs-server` — Start Docker containers for Swagger UI, ReDoc, Atlas.
- `sbt start-docs-server stop` — Stop the documentation containers.

## Configuration

Uses `api.url` from config. Requires running Supabase (keys from docker-compose) to fetch OpenAPI spec.

## File Layout

```
plugin-docs-server/
└── src/index.ts   # SbtPlugin with start-docs-server command
```
