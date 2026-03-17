---
description: Flagship plugin — 21 tools, 4 workflows, intent graph, release gate, HTTP tool surface for AI agents.
---

# @sbtools/plugin-migration-studio

[![npm](https://img.shields.io/npm/v/@sbtools/plugin-migration-studio.svg)](https://www.npmjs.com/package/@sbtools/plugin-migration-studio)

The flagship plugin. Provides a complete **backend design platform** for Supabase projects across five layers: Understand → Design → Generate → Validate → Apply. Every tool is available via both CLI (`sbt studio-<tool>`) and HTTP (`POST /api/studio/<tool>`), making the platform directly usable by AI agents.

## Installation

```bash
npm install @sbtools/plugin-migration-studio
```

```json
{
  "plugins": [
    { "path": "@sbtools/plugin-migration-studio", "config": {} }
  ]
}
```

## Starting the Server

```bash
sbt migration-studio            # port 3335 (default)
sbt migration-studio --port N   # custom port
sbt migration-studio --restart  # force-restart if port in use
```

## LLM / Agent Usage

> **Using Claude Desktop, Cursor, or VS Code?** The [`@sbtools/mcp-server`](./plugin-mcp-server) package exposes every tool below as a first-class MCP tool — no HTTP needed.

AI agents using the HTTP API can orient themselves in one call:

```
GET /api/studio/llm-context
```

Returns: intent graph summary, artifact freshness, full tool catalog with descriptions, migration count. Then the agent can call any tool:

```
POST /api/studio/introspect      → snapshot the DB
POST /api/studio/intent-init     → build intent graph
POST /api/studio/create-table    → generate migration SQL
POST /api/studio/release-gate    → validate before applying
POST /api/apply                  → apply if gate passes
```

Discover available tools and workflows:

```
GET /api/studio/catalog?audience=backend-dev&mode=managed&type=tools
```

## Tool Catalog (21 tools)

### Understand Layer

| CLI Command | HTTP Route | Produces Artifact |
|---|---|---|
| `studio-introspect` | `POST /api/studio/introspect` | `studio.schema.snapshot` |
| `studio-sql-parse` | `POST /api/studio/sql-parse` | `studio.sql.ast` |
| `studio-intent-sync` | `POST /api/studio/intent-sync` | `studio.intent.sync-report` |
| `studio-intent-init` | `POST /api/studio/intent-init` | `studio.intent.graph` |

### Generate Layer (Scaffold Tools)

| CLI Command | HTTP Route | What it generates |
|---|---|---|
| `studio-create-table` | `POST /api/studio/create-table` | `CREATE TABLE` migration |
| `studio-add-column` | `POST /api/studio/add-column` | `ALTER TABLE ... ADD COLUMN` |
| `studio-add-index` | `POST /api/studio/add-index` | `CREATE INDEX` |
| `studio-add-constraint` | `POST /api/studio/add-constraint` | `ALTER TABLE ... ADD CONSTRAINT` |
| `studio-add-rls-policy` | `POST /api/studio/add-rls-policy` | `CREATE POLICY` |
| `studio-add-function` | `POST /api/studio/add-function` | `CREATE OR REPLACE FUNCTION` |
| `studio-create-rpc` | `POST /api/studio/create-rpc` | RPC function (schema: public) |
| `studio-create-view` | `POST /api/studio/create-view` | `CREATE OR REPLACE VIEW` |

### Validate Layer

| CLI Command | HTTP Route | Produces Artifact |
|---|---|---|
| `studio-rls-check` / `studio-migration-lint` | `POST /api/studio/rls-check` | `studio.rls.plan` + `studio.rls.report` |
| `studio-migration-lint` | `POST /api/studio/migration-lint` | `studio.migration.lint` |
| `studio-rpc-lint` | `POST /api/studio/rpc-lint` | `studio.rpc.plan` |
| `studio-migration-plan` | `POST /api/studio/migration-plan` | `studio.migration.plan` |
| `studio-release-gate` | `POST /api/studio/release-gate` | `studio.release.gate` |

### Graph & Mapping

| CLI Command | HTTP Route | Description |
|---|---|---|
| `studio-intent-patch` | `POST /api/studio/intent-graph/entity` | Mutate entity managed-status |
| `studio-endpoint-map` | `POST /api/studio/endpoint-map` | Derive PostgREST endpoints from intent graph |
| `studio-greenfield-init` | `POST /api/studio/greenfield-init` | Init empty intent graph for new project |

## Workflow Catalog (4 workflows)

Workflows chain multiple tools with optional human checkpoints.

| Workflow ID | Steps | Use Case |
|---|---|---|
| `adopt-backend` | introspect → sql-parse → intent-sync → intent-init | Brownfield project adoption (2 checkpoints) |
| `release-check` | migration-plan → rls-check → rpc-lint → release-gate | Pre-release validation |
| `create-table` | create-table → sql-parse | Table + immediate AST update |
| `add-rls-policy` | add-rls-policy → rls-check | Policy + immediate coverage check |

Run the brownfield adoption workflow:

```bash
sbt studio-adopt
```

Browse all workflows: `GET /api/studio/catalog?type=workflows`

## Intent Graph

The intent graph (`studio.intent.graph`) is the central artifact. It assigns every DB entity a `managedStatus`:

| Status | Meaning |
|---|---|
| `managed` | Full confidence — schema matches SQL, safe to modify |
| `assisted` | Partial match — LLM/human should review before modifying |
| `opaque` | Unknown origin — do not modify without explicit human sign-off |
| `excluded` | Intentionally excluded from tracking |

Read the current graph: `GET /api/studio/intent-graph`

Mutate an entity's status: `POST /api/studio/intent-graph/entity`

## Release Gate

The release gate (`studio-release-gate`) aggregates evidence from all validation tools into a single `{ status: 'pass' | 'fail', reasons: [] }` signal. `POST /api/apply` respects the gate — migrations are blocked if the gate has failed.

This is the recommended final step before any migration apply, especially for LLM-driven pipelines.

## Migration Studio UI

The plugin also provides a **CodeMirror 6 SQL editor** UI accessible at `http://localhost:3335` (or via the dashboard at `/studio`). Features:

- Syntax highlighting, autocomplete (tables/columns from DB schema)
- SQL analysis and dry-run validation
- Save/apply migration files
- Schema sidebar and migration list

## HTTP API Reference

| Route | Description |
|---|---|
| `GET /api/health` | Health check |
| `GET /api/events` | SSE — live cache invalidation events |
| `GET /api/schema` | Live DB schema (tables, columns, policies, functions) |
| `GET /api/templates` | Migration template list |
| `GET /api/migrations` | Migration file list |
| `POST /api/analyze` | SQL analysis (parse + classify operations) |
| `POST /api/validate` | SQL dry-run against live schema |
| `POST /api/save` | Save SQL to a migration file |
| `POST /api/apply` | Apply pending migrations (enforces release gate) |
| `GET /api/studio/llm-context` | Full project orientation for AI agents |
| `GET /api/studio/intent-graph` | Current intent graph or null |
| `GET /api/studio/catalog` | Filterable tool/workflow catalog |
| `GET /api/studio/adopt/status` | Current adoption workflow run state |
| `POST /api/studio/adopt/start` | Start adoption workflow |
| `POST /api/studio/adopt/resume` | Resume from checkpoint |
| `POST /api/studio/<tool>` | Run any discovered tool (21 total) |

## Artifacts Produced

| Artifact | Description |
|---|---|
| `studio.schema.snapshot` | Live DB schema as typed nodes |
| `studio.sql.ast` | SQL AST from migration files |
| `studio.intent.sync-report` | Confidence scores per entity (DB vs SQL) |
| `studio.intent.graph` | Typed entity graph with managed/assisted/opaque status |
| `studio.rls.plan` | Suggested RLS policies for uncovered entities |
| `studio.rls.report` | RLS coverage analysis and gaps |
| `studio.migration.lint` | Risk flags, naming violations, lock-safety |
| `studio.rpc.plan` | Function security audit results |
| `studio.migration.plan` | Ordered change plan with change-class annotations |
| `studio.release.gate` | Aggregated pass/fail gate with blocking reasons |
| `studio.apply.log` | Apply history with timestamps and output |
| `studio.workflow.run` | Current workflow run state (for resuming) |

## See Also

- [Platform Architecture →](./plugin-migration-studio-platform) — 5-layer design and contributing guide
- [CLI Reference →](../cli-reference) — Full command listing with flags
