# @sbtools/plugin-erd

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

```json
{
  "erd": {
    "displayColumns": ["name", "email", "full_name", "slug", "title"]
  }
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `erdOutput` | `docs/entity-relations` | Output directory |
| `displayColumns` | (see package) | Columns to display on references |
