---
description: MCP server for @sbtools/mcp-server — exposes all 21 studio tools and 3 resources over stdio for Claude Desktop, Cursor, and VS Code Copilot.
---

# @sbtools/mcp-server

[![npm](https://img.shields.io/npm/v/@sbtools/mcp-server.svg)](https://www.npmjs.com/package/@sbtools/mcp-server)

A thin MCP ([Model Context Protocol](https://modelcontextprotocol.io/)) server that exposes every `@sbtools/plugin-migration-studio` tool and resource to AI agents via stdio. No business logic lives here — it is a registration layer over the existing tool catalog.

## Quick Start

```bash
npx @sbtools/mcp-server --cwd /path/to/your/supabase-project
```

Or point directly at the built file if you are in the monorepo:

```bash
node packages/mcp-server/dist/index.js --cwd /path/to/your/supabase-project
```

## Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or the equivalent path on your OS:

```json
{
  "mcpServers": {
    "sbtools": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"],
      "cwd": "/absolute/path/to/your/supabase-project"
    }
  }
}
```

With `npx`:

```json
{
  "mcpServers": {
    "sbtools": {
      "command": "npx",
      "args": ["@sbtools/mcp-server"],
      "cwd": "/absolute/path/to/your/supabase-project"
    }
  }
}
```

## `--cwd` Flag

The server walks up from its working directory looking for `supabase-tools.config.json` to locate the project root. If it is not found it falls back to `cwd`. Override explicitly:

```bash
node dist/index.js --cwd /path/to/project
```

## Tools (21)

All tools discovered from `@sbtools/plugin-migration-studio`'s tool catalog are registered automatically. The MCP tool name matches the studio tool ID exactly (e.g. `studio-introspect`, `studio-release-gate`).

### Understand Layer

| Tool ID | What it does |
|---|---|
| `studio-introspect` | Query live DB → `studio.schema.snapshot` artifact |
| `studio-sql-parse` | Parse migration files → `studio.sql.ast` artifact |
| `studio-intent-sync` | Confidence-score DB entities vs SQL → `studio.intent.sync-report` |
| `studio-intent-init` | Build intent graph from sync report → `studio.intent.graph` |

### Generate Layer

| Tool ID | What it generates |
|---|---|
| `studio-create-table` | `CREATE TABLE` migration |
| `studio-add-column` | `ALTER TABLE … ADD COLUMN` migration |
| `studio-add-index` | `CREATE INDEX` migration |
| `studio-add-constraint` | `ALTER TABLE … ADD CONSTRAINT` migration |
| `studio-add-rls-policy` | `CREATE POLICY` migration |
| `studio-add-function` | `CREATE OR REPLACE FUNCTION` migration |
| `studio-create-rpc` | RPC function (schema: public) migration |
| `studio-create-view` | `CREATE OR REPLACE VIEW` migration |
| `studio-greenfield-init` | Initialize empty intent graph for a new project |

### Validate Layer

| Tool ID | What it validates |
|---|---|
| `studio-rls-check` | RLS coverage gaps per entity |
| `studio-rpc-lint` | Function security (DEFINER, search_path, exposure) |
| `studio-migration-plan` | Ordered SQL change plan vs intent graph |
| `studio-lint` | Migration file risk flags and naming violations |
| `studio-release-gate` | Aggregated pass/fail gate with blocking reasons |

### Graph & Mapping

| Tool ID | Description |
|---|---|
| `studio-intent-patch` | Mutate a single entity's managed-status |
| `studio-endpoint-map` | Derive PostgREST endpoints from intent graph entities/functions |

## Resources (3)

Resources are read-only and available in any MCP client that supports resource listing.

| Resource URI | Content |
|---|---|
| `sbtools://studio/catalog` | Full tool + workflow catalog (filterable JSON) |
| `sbtools://studio/intent-graph` | Current `studio.intent.graph` artifact data or `null` |
| `sbtools://studio/llm-context` | Single-call orientation: intent graph summary, artifact freshness, gate status, catalog |

Read `sbtools://studio/llm-context` first — it is the fastest way for an AI agent to understand the project state.

## Typical Agent Workflow

```
1. Read sbtools://studio/llm-context      ← orient: what exists, what's stale
2. Call studio-introspect                 ← snapshot the live DB
3. Call studio-sql-parse                  ← parse migration history
4. Call studio-intent-sync                ← score confidence
5. Call studio-intent-init                ← build intent graph
6. Call studio-release-gate               ← validate before any apply
```

## Monorepo Convenience

If the MCP server package is installed alongside `plugin-migration-studio`, you can start it via:

```bash
sbt mcp
# or
sbt mcp --cwd /path/to/project
```

## See Also

- [plugin-migration-studio →](./plugin-migration-studio) — all 21 tools with HTTP + CLI reference
- [CLI Reference →](../cli-reference) — `sbt mcp` command
