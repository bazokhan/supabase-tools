# @sbtools/plugin-erd

Plugin for [supabase-tools](https://github.com/supabase/supabase) that generates Mermaid ERD diagrams for each public table. Connects to the database to introspect columns, primary keys, and foreign keys.

## Quick Start

```bash
# Ensure database is running (sbt start)
npm run sbt -- generate-erd
# Output: docs/entity-relations/<table>.md
```

## Commands

| Command | Description |
|---------|-------------|
| `generate-erd` | Generate Mermaid ERD diagrams for all public tables |

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
| `erdOutput` | `<docsOutput>/entity-relations` | Output directory for .md files |
| `displayColumns` | `["name", "email", "full_name", "slug", "title"]` | Column names to display on referenced entities |

## Project Structure

```
packages/plugin-erd/
├── src/
│   ├── index.ts   # Plugin entry, generate-erd command
│   └── builder.ts # Mermaid generation, column mapping
├── package.json
├── tsconfig.json
└── README.md
```
