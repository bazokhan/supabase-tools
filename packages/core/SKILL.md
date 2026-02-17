# @sbtools/core

## Purpose

Core CLI orchestrator for supabase-tools — config loading, plugin lifecycle, Docker Compose management, migration runner, snapshot pipeline, and the development dashboard server.

## When to Use

Use this skill when the user needs to:
- Modify or add CLI commands
- Change config loading or validation logic
- Update Docker/Compose orchestration
- Work on the snapshot pipeline (extractors → parsers → generators)
- Modify the dashboard HTTP server
- Change the plugin loader or command registry
- Update pre-flight checks

## Architecture

Entry point: `src/cli.ts` → loads config → loads plugins → dispatches to command registry.

### Command Registry

All core commands are registered in `src/commands/register-core.ts`. Plugin commands are merged at runtime by the plugin loader.

### Snapshot Pipeline

Three-phase pipeline: **extractors** (SQL queries → raw rows) → **parsers** (normalize/enrich) → **generators** (write snapshot files).

Each phase has per-object-type modules (functions, views, triggers, policies, types, enums) in the corresponding directory.

### Dashboard Server

`src/commands/dashboard.ts` — Node.js HTTP server serving:
- Static SPA files from the bundled `dashboard/` directory (built by `@sbtools/ui-web`)
- `/api/atlas-data` — serves `backend-atlas-data.json`
- `/api/dashboard-config` — merges `getDashboardView()` from all loaded plugins

## File Layout

```
core/
├── src/
│   ├── cli.ts                  # Entry point, arg parsing, dispatch
│   ├── config.ts               # Config loading and validation
│   ├── plugin-loader.ts        # Dynamic plugin loading from config
│   ├── command-registry.ts     # Command registration and lookup
│   ├── preflight.ts            # Pre-flight checks per command
│   ├── commands/
│   │   ├── register-core.ts    # Registers all core commands
│   │   ├── docker.ts           # start, stop, restart
│   │   ├── status.ts           # Service status display
│   │   ├── migrate.ts          # Migration runner
│   │   ├── snapshot.ts         # Snapshot pipeline orchestrator
│   │   ├── generate-data.ts    # Generate backend-atlas-data.json
│   │   ├── dashboard.ts        # Dashboard HTTP server
│   │   ├── docs.ts             # Documentation services (swagger, redoc, schemaspy)
│   │   ├── watch.ts            # File/DB watcher
│   │   ├── init.ts             # Config file generator
│   │   └── help.ts             # Help text generation
│   ├── extractors/             # SQL extractors (functions, views, triggers, etc.)
│   ├── parsers/                # Row normalization and enrichment
│   ├── generators/             # Snapshot file writers
│   ├── watch/                  # Watch scheduler and DB hooks
│   └── utils/
├── dashboard/                  # Bundled SPA (copied from ui-web at build time)
└── package.json
```

## Core Commands

| Command | Category | Description |
|---------|----------|-------------|
| `start` | Docker | Start all Supabase Docker services |
| `stop` | Docker | Stop all services |
| `restart` | Docker | Restart all services |
| `status` | Docker | Show service URLs, keys, connection info |
| `migrate` | Database | Apply SQL migrations to running DB |
| `snapshot` | Database | Export DB objects to filesystem |
| `watch` | Database | Watch DB/files and keep artifacts refreshed |
| `generate-atlas` | Code Generation | Generate backend-atlas-data.json |
| `docs` | Docs | Start documentation services (swagger, redoc, schemaspy) |
| `dashboard` | Docs | Start the development dashboard UI |
| `init` | Setup | Generate config file with defaults |
