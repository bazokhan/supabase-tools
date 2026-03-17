# @sbtools/mcp-server

MCP (Model Context Protocol) server for supabase-tools. Exposes all Migration Studio tools and resources over stdio so AI agents (Claude, Cursor, VS Code Copilot) can drive your Supabase backend workflow directly.

## Installation

```bash
npm install -g @sbtools/mcp-server
```

Or run without installing:

```bash
npx @sbtools/mcp-server
```

## Usage

The server communicates over stdio. Point your MCP client at the binary:

```bash
sbtools-mcp [--cwd /path/to/project]
```

- `--cwd` — override the working directory (defaults to `process.cwd()`). The server walks up from this directory looking for `supabase-tools.config.json`.

## Client Configuration

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "sbtools": {
      "command": "npx",
      "args": ["@sbtools/mcp-server", "--cwd", "/path/to/your/project"]
    }
  }
}
```

### Cursor / VS Code (`.cursor/mcp.json` or `mcp.json`)

```json
{
  "mcpServers": {
    "sbtools": {
      "command": "npx",
      "args": ["@sbtools/mcp-server", "--cwd", "/path/to/your/project"]
    }
  }
}
```

## Tools Exposed

All 20 Migration Studio tools are registered as MCP tools:

| Tool | What it does |
|------|-------------|
| `studio-introspect` | Introspect live DB schema → `studio.schema.snapshot` |
| `studio-sql-parse` | Parse migration files → SQL AST artifact |
| `studio-intent-sync` | Score confidence per entity (DB vs migrations) |
| `studio-intent-init` | Build intent graph from sync report |
| `studio-greenfield-init` | Initialize empty intent graph for a new project |
| `studio-intent-patch` | Reclassify an entity (managed / assisted / excluded) |
| `studio-endpoint-map` | Derive PostgREST endpoints from the intent graph |
| `studio-create-table` | Generate `CREATE TABLE` migration |
| `studio-add-column` | Generate `ADD COLUMN` migration |
| `studio-add-rls-policy` | Generate `CREATE POLICY` migration |
| `studio-add-index` | Generate `CREATE INDEX` migration |
| `studio-add-constraint` | Generate `ADD CONSTRAINT` migration |
| `studio-add-function` | Generate `CREATE OR REPLACE FUNCTION` migration |
| `studio-create-rpc` | Generate public-schema RPC function migration |
| `studio-create-view` | Generate `CREATE OR REPLACE VIEW` migration |
| `studio-rls-check` | Audit RLS coverage across managed entities |
| `studio-rpc-lint` | Audit function security (search_path, definer exposure) |
| `studio-lint` | Lint migration files (destructive ops, naming, lock safety) |
| `studio-migration-plan` | Diff intent graph vs snapshot → ordered change plan |
| `studio-release-gate` | Aggregate all validation findings → pass/fail gate |

## Resources Exposed

| URI | Description |
|-----|-------------|
| `sbtools://studio/catalog` | Full tool and workflow catalog (JSON) |
| `sbtools://studio/intent-graph` | Current intent graph artifact (JSON) |
| `sbtools://studio/llm-context` | One-call orientation summary: intent graph stats, gate status, migration count, catalog |

## Prerequisites

- Node.js 18+
- A project with `supabase-tools.config.json` (or defaults apply)
- For DB-aware tools (`studio-introspect`, scaffold tools): a running Supabase/Postgres instance reachable at the configured `api.url`
