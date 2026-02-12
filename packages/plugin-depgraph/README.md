# @sbtools/plugin-depgraph

Plugin for [supabase-tools](../../) that visualizes all backend dependency relationships (tables, functions, triggers, policies, views, enums, FK constraints) as an interactive HTML graph and Mermaid diagrams. Zero external dependencies — reads from already-generated snapshot and atlas data files.

## Quick Start

```bash
# 1. Add to supabase-tools.config.json → plugins array:
#    { "path": "@sbtools/plugin-depgraph", "config": {} }

# 2. Ensure atlas data exists
npx tsx supabase-tools/cli.ts generate-atlas

# 3. Generate dependency graphs
npx tsx supabase-tools/cli.ts depgraph
#    → docs/dependency-graph.html
#    → docs/dependency-graph.md
```

## Commands

| Command | Description |
|---|---|
| `depgraph` | Generate both HTML and Mermaid dependency graphs |
| `depgraph --html` | Generate only the interactive HTML graph |
| `depgraph --mermaid` | Generate only the Mermaid flowchart |
| `depgraph --json` | Output raw graph data as JSON |
| `depgraph --help` | Show full help |

All commands: `npx tsx supabase-tools/cli.ts depgraph <options>`

## Relationships Detected

| Relationship | Source | Target | How |
|---|---|---|---|
| fires on | trigger | table | `trigger.table` field |
| calls | trigger | function | `trigger.function_name` field |
| guards | policy | table | `policy.table` field |
| calls in check | policy | function | Parse `USING` / `WITH CHECK` expressions |
| references | function | table | Parse function SQL body |
| reads from | view | table | Parse view SQL for `FROM`/`JOIN` |
| uses enum | table | enum | TypeScript types enum column detection |
| FK to | table | table | TypeScript types `Relationships` arrays |

## Interactive HTML Graph

The generated `docs/dependency-graph.html` provides:

- Force-directed SVG layout (no external libraries)
- Colored nodes by type (tables=blue, functions=green, triggers=orange, policies=purple, views=teal, enums=pink)
- Click a node to highlight its direct dependencies
- Filter checkboxes to show/hide node types
- Search box to find specific nodes
- Zoom and pan via mouse
- Tooltips with node metadata

## Configuration

Add to `supabase-tools.config.json`:

```json
{
  "plugins": [
    {
      "path": "@sbtools/plugin-depgraph",
      "config": {}
    }
  ]
}
```

No config fields needed — all paths are derived from the plugin context.

## Requirements

- Node.js 18+
- `tsx` (installed as devDependency in the parent project)
- `docs/backend-atlas-data.json` must exist (run `sbt generate-atlas` first)
- No additional npm dependencies

## Project Structure

```
plugin-depgraph/
├── index.ts              # Plugin entry point
├── src/
│   ├── index.ts          # Plugin implementation
│   ├── graph-builder.ts  # Atlas data parser, node/edge builder
│   ├── mermaid-generator.ts # Mermaid flowchart output
│   ├── html-generator.ts # Interactive HTML graph builder
│   └── atlas/
│       ├── cards.ts      # Card renderers for Backend Atlas
│       ├── sections.ts   # HTML section stubs
│       └── styles.ts     # Additional CSS
├── package.json
├── SKILL.md
└── README.md
```
