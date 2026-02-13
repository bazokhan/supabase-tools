# @sbt/plugin-docs-server

Plugin that starts API documentation services (Swagger UI, ReDoc, Backend Atlas, SchemaSpy). Lives in `supabase-tools/packages/plugin-docs-server/`.

## When to Use

Use this plugin when the user needs to:
- Serve interactive API docs (Swagger, ReDoc)
- Run Backend Atlas or SchemaSpy in a served environment

## CLI Commands

- `sbt docs` / `sbt docs all` — Start all documentation containers
- `sbt docs swagger` / `sbt docs redoc` / `sbt docs atlas` / `sbt docs schemaspy` — Start individual services
- `sbt docs stop` — Stop the documentation containers

## Configuration

Uses `api.url` from config. Requires running Supabase (keys from docker-compose) to fetch OpenAPI spec.

## File Layout

```
plugin-docs-server/
└── src/index.ts   # SbtPlugin with docs command and subcommands
```
