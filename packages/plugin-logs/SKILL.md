# @sbtools/plugin-logs

Plugin for `supabase-tools` that provides live Docker log tailing, `pg_stat_statements` query performance monitoring, a standalone HTML log viewer, and Atlas integration. Lives at `supabase-tools/packages/plugin-logs/`.

## When to Use

Use this plugin when the user needs to:
- Tail logs from any Supabase Docker service in real time
- Check which Supabase services are running or stopped
- Monitor query performance via `pg_stat_statements`
- View logs in a browser with filtering, search, and service health
- Add query performance and service health data to the Backend Atlas

## Activation

Add to `supabase-tools.config.json`:

```json
{
  "plugins": [
    {
      "path": "node_modules/@sbtools/plugin-logs",
      "config": {
        "viewerPort": 3333,
        "tailLines": 100,
        "dbContainer": "supabase-db"
      }
    }
  ]
}
```

## CLI Commands

### Log Tailing

- `sbt logs` — Tail all running services simultaneously with coloured, multiplexed output. Streams until Ctrl+C.
- `sbt logs <service>` — Tail a single service. Valid services: `functions`, `db`, `rest`, `auth`, `kong`, `storage`, `realtime`, `studio`, `meta`, `inbucket`.
- `sbt logs --all` — Same as `sbt logs`.
- `sbt logs --list` — List all services with running/stopped status and container names.

Options:
- `--tail <N>` — Number of historical lines to show (default: 100)
- `--no-color` — Disable ANSI colour output
- `--timestamps` — Show Docker timestamps

### Query Performance

- `sbt logs pg-stats` — Show top 20 queries by total execution time.
- `sbt logs pg-stats --slow` — Top 20 by mean execution time.
- `sbt logs pg-stats --frequent` — Top 20 by call count.
- `sbt logs pg-stats --reset` — Reset all `pg_stat_statements` data.
- `sbt logs pg-stats --json` — Output raw JSON instead of formatted table.

### Log Viewer

- `sbt logs viewer` — Start the live HTML log viewer at `http://localhost:3333`.
- `sbt logs viewer --port <N>` — Use a custom port.

The viewer provides:
- Real-time log streaming via Server-Sent Events
- Service filter chips (toggle individual services on/off)
- Log level filters (ERROR, WARN, INFO, DEBUG)
- Full-text search across log messages
- Auto-scroll with pause/resume
- Query Performance tab showing `pg_stat_statements` data
- Service Health tab showing container status

## Prerequisites

### pg_stat_statements

The `pg_stat_statements` extension is enabled automatically by `supabase-tools/docker/db-init.sql` when the database container starts. The Supabase Postgres image includes the extension in `shared_preload_libraries` by default.

If you see errors about the extension not being available, ensure:
1. You are using `supabase/postgres:17+` image
2. The database container has been restarted after the `db-init.sql` change
3. You can manually enable it: `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;`

### Docker

All log tailing and container discovery requires Docker to be running. The plugin discovers containers by deriving the Docker Compose project prefix from `project.name` in `supabase-tools.config.json` via `@sbtools/sdk`'s `deriveContainerPrefix`.

Container name pattern: `{prefix}-supabase-{service}`

## Plugin Configuration

All fields are optional:

| Field | Default | Description |
|-------|---------|-------------|
| `viewerPort` | `3333` | HTTP port for the log viewer |
| `tailLines` | `100` | Default number of historical lines when tailing |
| `dbContainer` | `"supabase-db"` | Container suffix for the database (used for `pg_stat_statements`) |

## Atlas Integration

When `sbt generate-atlas` runs, this plugin contributes:

- **Query Performance section**: Top queries by total execution time with call count, timing, and cache hit rate.
- **Service Health section**: Running/stopped status for each Docker container.
- **Stat cards**: "DB Queries Tracked" count and "Services Running" count in the hero.
- **Kind filters**: "Query Performance" and "Service Health" chips in the filter bar.

## How It Works

### Log Tailing
Uses `child_process.spawn` to run `docker logs -f --tail N <container>`. Each service's output is parsed by a service-specific formatter that extracts timestamps, detects log levels, and applies ANSI colours. Multiple services are multiplexed with coloured service prefixes.

### pg_stat_statements
Queries the database via `docker exec <db-container> psql -U postgres -d postgres -At -c "..."`. No `pg` npm dependency needed. The extension is bootstrapped with `CREATE EXTENSION IF NOT EXISTS` on first use.

### Log Viewer
A Node.js HTTP server using only the built-in `http` module. The SSE endpoint spawns `docker logs -f` for each requested service and pipes parsed log lines as JSON events. The HTML page is a self-contained single-page app with inline CSS and JS.

### Container Discovery
Reads `supabase-tools.config.json` to get `project.name`, then derives the Docker container prefix via `@sbtools/sdk` (`deriveContainerPrefix` or `sanitizeContainerPrefix`). Same logic used by core `cli.ts` and migrate.

## File Layout

```
plugin-logs/
├── src/
│   ├── index.ts       # SbtPlugin with logs command + hooks
│   ├── atlas.ts       # Atlas UI via buildAtlasUI() — query perf + service health sections
│   ├── docker-logs.ts # Container discovery, log tailing, process lifecycle
│   ├── formatter.ts   # Per-service log parsing and ANSI colourisation
│   ├── pg-stats.ts    # pg_stat_statements queries via docker exec psql
│   ├── viewer.ts      # HTTP + SSE server for live log viewer
│   ├── viewer-html.ts # Single-page HTML builder (dark theme, matching Atlas)
│   └── atlas/
│       └── styles.ts  # Additional CSS for Atlas cards
├── package.json
└── SKILL.md
```
