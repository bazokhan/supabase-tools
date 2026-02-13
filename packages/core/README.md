# @sbtools/core

Core CLI orchestrator for supabase-tools — config, plugin loader, snapshot pipeline.

## Installation

```bash
npm install @sbtools/core
```

## Usage

```bash
npx sbt <command>
```

Or add to your `package.json`:

```json
{
  "scripts": {
    "sbt": "sbt",
    "start": "sbt start",
    "migrate": "sbt migrate"
  }
}
```

Then `npm run start`, etc.

## What's Included

- Config loading and validation (`supabase-tools.config.json`)
- Dynamic plugin loader (npm packages or filesystem paths)
- Docker Compose management (Supabase stack)
- Migration runner
- Snapshot pipeline (export DB schema)
- Pre-flight checks

## Dependencies

| Type | Requirement |
|------|-------------|
| Docker | Must be running for `start`, `stop`, `restart`, `status`, `snapshot`, `migrate` |
| Compose files | `docker-compose.db.yml` in toolsDir |
| Migrations dir | `config.paths.migrations` must exist for `migrate` |
| Snapshot meta | `supabase/current/_meta/snapshot.json` must exist for `generate-atlas` (run `sbt snapshot` first) |

## Plugins

Add plugins via config:

```json
{
  "plugins": [
    { "path": "@sbtools/plugin-erd", "config": {} }
  ]
}
```

Plugins add commands like `generate-erd`, `test`, `logs`, etc.
