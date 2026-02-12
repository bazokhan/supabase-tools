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

Add to `supabase-tools.config.json`:

```json
{
  "erd": {
    "displayColumns": ["name", "email", "full_name", "slug", "title"]
  }
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `erdOutput` | `docs/entity-relations` | Output directory for .md files |
| `displayColumns` | See package | Column names to display on referenced entities |

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
