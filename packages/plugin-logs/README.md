# @sbtools/plugin-logs

Plugin for [supabase-tools](../../) that adds live Docker log tailing, `pg_stat_statements` query performance monitoring, and a browser log viewer rendered via shared `@sbtools/ui-web`.

## Quick Start

```bash
# 1. Add to supabase-tools.config.json → plugins array:
#    { "path": "@sbtools/plugin-logs", "config": {} }

# 2. Tail all services
npx tsx supabase-tools/cli.ts logs

# 3. Open the live log viewer
npx tsx supabase-tools/cli.ts logs viewer
#    → http://localhost:3333
```

## Commands

| Command | Description |
|---|---|
| `logs` | Tail all running services (multiplexed, coloured) |
| `logs <service>` | Tail a single service (e.g. `logs functions`, `logs db`) |
| `logs --list` | List services with running/stopped status |
| `logs pg-stats` | Top 20 queries by total execution time |
| `logs pg-stats --slow` | Top 20 by mean execution time |
| `logs pg-stats --frequent` | Top 20 by call count |
| `logs pg-stats --reset` | Reset pg_stat_statements data |
| `logs pg-stats --json` | Output raw JSON |
| `logs viewer` | Start live HTML log viewer (default port 3333) |
| `logs viewer --port N` | Custom viewer port |
| `logs --help` | Show full help |

All commands: `npx tsx supabase-tools/cli.ts logs <subcommand>`

Available services: `functions`, `db`, `rest`, `auth`, `kong`, `storage`, `realtime`, `studio`, `meta`, `inbucket`.

## Log Viewer

The viewer at `http://localhost:3333` provides:

- Real-time log streaming via Server-Sent Events
- Service filter chips (toggle individual services on/off)
- Log level filters (ERROR, WARN, INFO, DEBUG)
- Full-text search across log messages
- Auto-scroll with pause/resume
- Query Performance tab with sortable `pg_stat_statements` data
- Service Health tab showing container status

## Configuration

Add to `supabase-tools.config.json`:

```json
{
  "plugins": [
    {
      "path": "@sbtools/plugin-logs",
      "config": {
        "viewerPort": 3333,
        "tailLines": 100,
        "dbContainer": "supabase-db"
      }
    }
  ]
}
```

All config fields are optional and have sensible defaults.

## Dependencies

| Type | Requirement |
|------|-------------|
| Docker | Must be running; containers discovered via `deriveContainerPrefix` |
| Config | `project.name` in `supabase-tools.config.json` (or basename fallback) |

## Requirements

- Docker (services must be running for log tailing)
- Node.js 18+
- `tsx` (installed as devDependency in the parent project)
- No additional npm dependencies

## Project Structure

```
plugin-logs/
├── index.ts          # Plugin entry point
├── src/
│   ├── index.ts      # Plugin implementation
│   ├── docker-logs.ts # Container discovery and log tailing
│   ├── formatter.ts  # Log parsing and ANSI colourisation
│   ├── pg-stats.ts   # pg_stat_statements via docker exec psql
│   ├── viewer.ts     # HTTP + SSE server
│   ├── viewer-html.ts # Delegates page rendering to @sbtools/ui-web
│   └── atlas/
│       └── styles.ts # Additional CSS for atlas sections
├── package.json
├── SKILL.md
└── README.md
```
