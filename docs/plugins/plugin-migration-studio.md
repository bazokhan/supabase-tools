---
description: Migration authoring UI for supabase-tools — create migrations, analyze SQL, apply via sbt migrate.
---

# plugin-migration-studio

Migration authoring UI. Create migrations in a browser-based editor, analyze SQL for operations and risk, and apply via the core `sbt migrate` flow.

## Features

- SQL editor with live analysis
- Save migration files with timestamp prefix
- Apply migrations (requires confirmation, runs `sbt migrate`)
- Consumes `migration.analysis` artifact when migration-audit has run

## Installation

```bash
npm install @sbtools/plugin-migration-studio
```

## Activation

```json
{
  "plugins": [
    { "path": "@sbtools/plugin-migration-studio", "config": {} }
  ]
}
```

## Usage

```bash
sbt migration-studio
```

Starts the studio at http://localhost:3335. Use `--port N` to change the port.

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| (none) | — | — | No config options yet |

## Contract

- **Produces:** `migration.studio.draft` (planned)
- **Consumes:** `migration.analysis` (optional)

Apply path uses core migration execution; no duplicate engine.
