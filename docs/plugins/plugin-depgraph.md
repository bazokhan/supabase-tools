---
description: Visualize backend dependency relationships as interactive HTML graph and Mermaid diagrams.
---

# @sbtools/plugin-depgraph

[![npm](https://img.shields.io/npm/v/@sbtools/plugin-depgraph.svg)](https://www.npmjs.com/package/@sbtools/plugin-depgraph)

Plugin that visualizes backend dependency relationships (tables, functions, triggers, policies, views, enums) as an interactive HTML graph and Mermaid diagrams.

## Quick Start

```bash
npm install @sbtools/plugin-depgraph
```

Add to config: `{ "path": "@sbtools/plugin-depgraph" }`

```bash
# Ensure atlas data exists first
npx sbt generate-atlas

# Generate dependency graphs
npx sbt depgraph
# → docs/dependency-graph.html
# → docs/dependency-graph.md
```

## Commands

| Command | Description |
|---------|-------------|
| `depgraph` | Generate both HTML and Mermaid |
| `depgraph --html` | HTML only |
| `depgraph --mermaid` | Mermaid only |
| `depgraph --json` | Raw JSON output |

## Relationships

Tracks: triggers→tables, policies→tables, functions→tables, views→tables, FK constraints, enum usage.

## Requirements

Run `sbt generate-atlas` first — plugin reads from `docs/backend-atlas-data.json`.
