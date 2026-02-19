---
description: Understand your existing Postgres/Supabase backend. Brownfield adoption workflow — introspect, parse, confidence-score, and map what's managed vs opaque.
---

# Migration Studio Platform

[![npm](https://img.shields.io/npm/v/@sbtools/plugin-migration-studio.svg)](https://www.npmjs.com/package/@sbtools/plugin-migration-studio)

The Migration Studio Platform transforms the SQL editor into a **workflow-driven backend platform**. It adds a layer on top of raw SQL authoring: structured tools that inspect your live database and migration history, understand what they contain, and build a typed *intent graph* that records what the platform knows how to manage safely.

This page covers the **brownfield adoption toolchain** — the part that works with existing schemas. If you have a Supabase project already in production and want to understand it programmatically, these are the tools for you.

## What it does

```
Live DB ──────────────────► introspect ──────► studio.schema.snapshot
Migration files (.sql) ────► sql-parse  ──────► studio.sql.ast
                                                       │
                                              intent-sync (confidence scoring)
                                                       │
                                              studio.intent.sync-report
                                                       │
                                              intent-init (build graph)
                                                       │
                                              studio.intent.graph
```

Each step produces a **versioned artifact** written to `.sbt/artifacts/`. Artifacts are JSON files with stable IDs — readable, diffable, and usable as inputs to downstream tools.

## The adoption workflow

The **adopt-backend** workflow runs all four tools in sequence with two human checkpoints:

| Step | Tool | Output artifact | Checkpoint |
|------|------|-----------------|------------|
| 1 | `studio-introspect` | `studio.schema.snapshot` | — |
| 2 | `studio-sql-parse` | `studio.sql.ast` | — |
| — | *(review confidence scores)* | — | **review** |
| 3 | `studio-intent-sync` | `studio.intent.sync-report` | — |
| — | *(confirm managed scope)* | — | **approve** |
| 4 | `studio-intent-init` | `studio.intent.graph` | — |

After step 2 the workflow pauses. You review the sync report to see which entities were matched between DB and migrations, and at what confidence. After you approve, `intent-init` builds the final intent graph.

## What each tool produces

### `studio-introspect` → `studio.schema.snapshot`

Queries `pg_catalog` and `information_schema` for the live state of your database:

- All user tables with full column definitions (type, nullable, default, identity, generated)
- Constraints (PRIMARY KEY, UNIQUE, CHECK, FOREIGN KEY)
- Indexes (method, uniqueness, partial predicate)
- RLS policies (command, roles, USING/WITH CHECK expressions)
- Functions (language, security type, return type)
- Views and materialized views
- Triggers
- Extensions

System schemas (`auth`, `storage`, `realtime`, `supabase_functions`, `extensions`, `pg_catalog`, `information_schema`) are excluded from all queries.

```json
// .sbt/artifacts/studio.schema.snapshot/1.0.0/latest.json
{
  "id": "studio.schema.snapshot",
  "version": "1.0.0",
  "data": {
    "capturedAt": "2025-01-15T14:22:31.000Z",
    "pgVersion": "PostgreSQL 15.6",
    "entities": [
      {
        "id": "public.users",
        "schema": "public",
        "name": "users",
        "managedStatus": "managed",
        "confidence": 0.9,
        "columns": [
          { "name": "id", "type": "uuid", "nullable": false, "default": "gen_random_uuid()" },
          { "name": "email", "type": "text", "nullable": false },
          { "name": "created_at", "type": "timestamptz", "nullable": true, "default": "now()" }
        ],
        "constraints": [
          { "name": "users_pkey", "type": "primary_key", "columns": ["id"], "definition": "PRIMARY KEY (id)" }
        ],
        "indexes": []
      }
    ],
    "policies": [...],
    "extensions": [
      { "id": "extension:uuid-ossp", "type": "extension", "name": "uuid-ossp", "details": { "version": "1.1" } }
    ]
  }
}
```

### `studio-sql-parse` → `studio.sql.ast`

Reads every `.sql` file in your migrations directory alphabetically. For each file:

- Parses all statements using `@supabase/pg-parser` (real Postgres C parser compiled to WASM)
- Extracts structured intent nodes: entities, policies, functions, views, triggers, extensions
- Runs the regex analyzer for risk metadata (destructive ops, transaction wrapping)
- Records opaque blocks (DO $$ ... $$, statements that don't map to an intent node type)

All extracted nodes are aggregated into `allEntities`, `allPolicies`, etc. for easy access by downstream tools.

```json
// .sbt/artifacts/studio.sql.ast/1.0.0/latest.json
{
  "data": {
    "migrationsDir": "supabase/migrations",
    "parsedAt": "2025-01-15T14:22:35.000Z",
    "files": [
      {
        "filename": "20240101_init.sql",
        "statementCount": 4,
        "opaqueBlockCount": 1,
        "entities": [{ "id": "public.users", "schema": "public", "name": "users", "columns": [...] }],
        "policies": [{ "id": "public.users.users_select", "command": "SELECT", "roles": ["authenticated"] }],
        "riskMeta": { "riskFlags": { "hasTransaction": true, "hasDestructive": false } }
      }
    ],
    "allEntities": [...],
    "allPolicies": [...]
  }
}
```

### `studio-intent-sync` → `studio.intent.sync-report`

Matches entities between the DB snapshot and the SQL AST by their stable ID (`schema.name`). Produces a confidence score per entity:

| Condition | Score |
|-----------|-------|
| Entity found in both DB and migration files (base) | 0.85 |
| Column count exactly matches | +0.05 |
| All column names match | +0.05 |
| All column types match | +0.03 |
| Each column in DB missing from SQL | −0.10 |
| Each type mismatch per column | −0.05 |
| Entity in DB only (no migration found) | **0.35 fixed** |
| Entity in migrations only (not yet in DB) | **0.70 fixed** |

Score ≥ 0.80 → `managed`. 0.50–0.79 → `assisted`. < 0.50 → `opaque`.

```json
// .sbt/artifacts/studio.intent.sync-report/1.0.0/latest.json
{
  "data": {
    "syncedAt": "2025-01-15T14:22:37.000Z",
    "matched": [
      { "objectId": "public.users", "objectType": "entity", "confidence": 0.98 },
      { "objectId": "public.orders", "objectType": "entity", "confidence": 0.73, "driftDetails": "column 'legacy_id' in DB but not in SQL" }
    ],
    "unmatchedDb": [
      { "objectId": "public.audit_log", "objectType": "entity", "reason": "no_sql_source" }
    ],
    "unmatchedIntent": [
      { "objectId": "public.invoices", "objectType": "entity" }
    ],
    "summary": {
      "matchedCount": 14,
      "unmatchedDbCount": 2,
      "unmatchedIntentCount": 1,
      "averageConfidence": 0.881
    }
  }
}
```

### `studio-intent-init` → `studio.intent.graph`

Builds the intent graph from the sync report. High-confidence entities become `managed` — the platform understands them well enough to generate, update, and lint changes. Low-confidence or DB-only entities become `opaque` blocks, preserved verbatim.

```json
// .sbt/artifacts/studio.intent.graph/1.0.0/latest.json
{
  "data": {
    "version": "1.0.0",
    "mode": "brownfield-managed",
    "entities": [
      {
        "id": "public.users",
        "managedStatus": "managed",
        "confidence": 0.98,
        "columns": [...]
      },
      {
        "id": "public.orders",
        "managedStatus": "assisted",
        "confidence": 0.73,
        "columns": [...]
      }
    ],
    "opaqueBlocks": [
      {
        "id": "entity:public.audit_log",
        "reason": "too-complex",
        "astAvailable": false,
        "touchedObjects": ["public.audit_log"]
      }
    ],
    "managedScope": {
      "schemas": { "public": "managed", "auth": "excluded" },
      "explicitExclusions": []
    }
  }
}
```

## Running the adoption workflow

The adoption workflow is implemented as a typed pipeline definition. To run it programmatically:

```ts
import { startWorkflow, resumeWorkflow } from "@sbtools/plugin-migration-studio/src/engine/runner.js";
import {
  adoptBackendSteps,
  adoptBackendRegistry,
  ADOPT_BACKEND_WORKFLOW_ID,
} from "@sbtools/plugin-migration-studio/src/workflows/adopt-backend.js";

// Start — runs introspect + sql-parse, then pauses for review
const run = await startWorkflow(
  ADOPT_BACKEND_WORKFLOW_ID,
  adoptBackendSteps,
  ctx,           // PluginContext with sbtDataDir + paths.migrations
  adoptBackendRegistry
);

console.log(run.status); // 'waiting_checkpoint' — paused after sql-parse
console.log(run.steps);  // [{ stepId: 'introspect', status: 'completed' }, { stepId: 'sql-parse', status: 'completed' }]

// Review .sbt/artifacts/studio.intent.sync-report/... then resume
const completed = await resumeWorkflow(run, adoptBackendSteps, ctx, adoptBackendRegistry);
console.log(completed.status); // 'waiting_checkpoint' — paused after intent-sync

// Approve managed scope, then resume once more
const done = await resumeWorkflow(completed, adoptBackendSteps, ctx, adoptBackendRegistry);
console.log(done.status); // 'completed'
```

::: tip CLI commands coming
`sbt studio-adopt`, `sbt studio-introspect`, and `sbt studio-sync` commands are planned. The toolchain is infrastructure-complete; CLI wiring and HTTP API routes are next.
:::

## Reading the artifacts

All artifacts land in `.sbt/artifacts/` as `latest.json` files:

```
.sbt/artifacts/
  studio.schema.snapshot/1.0.0/latest.json   ← live DB state
  studio.sql.ast/1.0.0/latest.json            ← migration file parse results
  studio.intent.sync-report/1.0.0/latest.json ← confidence-scored match
  studio.intent.graph/1.0.0/latest.json       ← final intent graph
  studio.workflow.run/1.0.0/latest.json       ← run state (step results, status)
```

Read them from code:

```ts
import { readArtifactOrNull } from "@sbtools/sdk";
import type { SchemaSnapshotData } from "@sbtools/plugin-migration-studio/src/artifacts/writers.js";

const snapshot = readArtifactOrNull<SchemaSnapshotData>(ctx, "studio.schema.snapshot", "1.0.0");
if (snapshot) {
  console.log(`${snapshot.data.entities.length} tables found`);
  console.log(`${snapshot.data.policies.length} RLS policies`);
}
```

## Workflow engine

The engine (`engine/runner.ts`) is a ~120-line sequential pipeline runner with no external framework dependency:

```ts
import { startWorkflow, resumeWorkflow } from "...engine/runner.js";
import type { WorkflowStep, ToolRegistry } from "...engine/runner.js";
```

Key behaviors:

- **Sequential execution** — steps run in order; a step cannot start until the previous completes
- **Checkpoint pause** — steps with `checkpoint: 'review'` or `'approve'` pause the run and persist state; the caller resumes when ready
- **Failure isolation** — a failing step records the error in the run artifact and stops; subsequent steps are not called
- **Skip conditions** — steps with `skipWhen: (run) => boolean` are skipped if the condition holds at runtime
- **Full audit trail** — every step result (status, artifact produced, timestamps, error) is written to `studio.workflow.run`

Resuming a paused run:

```ts
// Load persisted run from artifact storage
const existingRun = loadWorkflowRun(ctx);
if (existingRun?.status === 'waiting_checkpoint') {
  const continued = await resumeWorkflow(existingRun, steps, ctx, registry);
}
```

## Artifact artifact IDs

| Artifact | ID | Version |
|----------|----|---------|
| DB schema snapshot | `studio.schema.snapshot` | 1.0.0 |
| SQL AST parse results | `studio.sql.ast` | 1.0.0 |
| Intent graph | `studio.intent.graph` | 1.0.0 |
| Sync report | `studio.intent.sync-report` | 1.0.0 |
| RLS plan | `studio.rls.plan` | 1.0.0 |
| RLS report | `studio.rls.report` | 1.0.0 |
| RPC plan | `studio.rpc.plan` | 1.0.0 |
| Migration plan | `studio.migration.plan` | 1.0.0 |
| Migration lint | `studio.migration.lint` | 1.0.0 |
| Release gate | `studio.release.gate` | 1.0.0 |
| Workflow run | `studio.workflow.run` | 1.0.0 |

## Confidence scoring explained

Confidence is a 0.0–1.0 score per entity node that answers: *"How well does the platform understand this object?"*

| Range | Status | What the platform does |
|-------|--------|------------------------|
| **0.80 – 1.0** | `managed` | Full management. Can generate, update, lint, gate. |
| **0.50 – 0.79** | `assisted` | Managed with caution. User must review before updates. |
| **< 0.50** | `opaque` | Preserved verbatim. Not touched by generation. |

An entity gets a high confidence score when:
- It appears in both the live DB and the migration files
- Its column names and types match between both sources
- There are no unexplained columns in the DB that don't appear in any migration

An entity gets a low confidence score when:
- It exists only in the DB with no migration history (manually created, seeded externally)
- Its DB columns diverge significantly from what the migrations declare

Opaque nodes are not deleted — they become `OpaqueBlock` entries in the intent graph with `reason: 'too-complex'`. Future tools can promote opaque nodes to assisted or managed as more intent graph node types are added.

## Managed scope rules

The platform never touches what it doesn't understand:

- **`managed`** — fully controlled; platform can generate and update SQL
- **`assisted`** — partially understood; user reviews before any changes
- **`opaque`** — unknown or too-complex; preserved verbatim, never rewritten
- **`excluded`** — explicitly opted out; ignored even if parseable

System schemas (`auth`, `storage`, `realtime`, etc.) are always `excluded`. User schemas default to `managed` in the scope declaration but individual objects within them may be `opaque` based on confidence.

## Dependencies

`pg` is required for `studio-introspect`. It is already listed in `plugin-migration-studio`'s dependencies.

`@supabase/pg-parser` (WASM) is required for `studio-sql-parse`. It lazy-loads the WASM binary on first parse call — no explicit initialization needed.

## See also

- [Migration Studio editor](./plugin-migration-studio.md) — the SQL authoring UI
- [Migration Audit](./plugin-migration-audit.md) — drift detection against the DB tracking table
- [Artifact Registry](../architecture/artifact-registry.md) — all artifact IDs in the project
- [Artifact Contract Guide](../architecture/artifact-contract-guide.md) — how to produce and consume artifacts
