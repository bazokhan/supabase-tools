# @sbtools/plugin-erd

Plugin that generates Mermaid ERD diagrams for each public table. Lives in `supabase-tools/packages/plugin-erd/`.

## When to Use

Use this plugin when the user needs to:
- Visualize table relationships (foreign keys, columns)
- Generate Mermaid diagrams for documentation
- Understand schema structure at a glance

## CLI Commands

- `sbt generate-erd` — Connect to the database, introspect public tables, and write Mermaid ERD markdown files to `docs/entity-relations/`.

## Configuration

- `erdOutput` — Output directory (default: `docs/entity-relations`)
- `erd.displayColumns` — Columns to show on referenced entities (e.g. `["name","email","title"]`)

## File Layout

```
plugin-erd/
├── src/index.ts   # SbtPlugin with generate-erd command
└── builder.ts     # Mermaid builder, FK/column parsing
```
