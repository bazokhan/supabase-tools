---
description: Generate Mermaid ERD diagrams for each public table. Connects to DB to introspect columns, keys, and relationships.
---

# @sbtools/plugin-erd

[![npm](https://img.shields.io/npm/v/@sbtools/plugin-erd.svg)](https://www.npmjs.com/package/@sbtools/plugin-erd)

Plugin that generates Mermaid ERD diagrams for each public table. Connects to the database to introspect columns, primary keys, and foreign keys.

## Quick Start

```bash
npm install @sbtools/plugin-erd
```

Add to config: `{ "path": "@sbtools/plugin-erd" }`

```bash
# Ensure database is running
npx sbt start
npx sbt generate-erd
# Output: docs/entity-relations/<table>.md
```

## Commands

| Command | Description |
|---------|-------------|
| `generate-erd` | Generate Mermaid ERD for all public tables |

## Configuration

Plugin config goes in `plugins[].config`:

```json
{
  "plugins": [{
    "path": "@sbtools/plugin-erd",
    "config": {
      "erdOutput": "docs/development/entity-relations",
      "displayColumns": ["name", "email", "full_name", "slug", "title"]
    }
  }]
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `erdOutput` | `<docsOutput>/entity-relations` | Output directory (derives from root `paths.docsOutput`) |
| `displayColumns` | `["name", "email", "full_name", "slug", "title"]` | Columns to display on referenced entities |

Global ERD display columns can also be set at the root level under `erd.displayColumns`.
