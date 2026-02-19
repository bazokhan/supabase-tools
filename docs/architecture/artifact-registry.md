# Artifact ID Registry

This document is the **single source of truth** for official artifact IDs in supabase-tools. All new artifact IDs must be registered here and follow the [artifact contract guide](./artifact-contract-guide.md).

## Naming rules

- `id` is stable and **never** includes version suffixes (e.g. `migration.analysis`, not `migration.analysis.v1`).
- Use dot-separated lowercase: `<domain>.<entity>` or `<domain>.<entity>.<plugin>`.
- Avoid duplicate semantics under different IDs.

## Status definitions

| Status | Meaning |
|--------|---------|
| **Active** | Producer and consumer both exist and work end-to-end |
| **Producing** | Producer writes the artifact; no consumer reads it yet |
| **Planned** | Defined in the plan but no implementation yet |
| **Convention** | Naming convention for a family of artifacts |
| **Optional** | Low-priority; implement only if ROI is justified |

## Official registry

| Artifact ID | Owner Package | Schema Version | Status | Description |
|-------------|---------------|----------------|--------|-------------|
| `atlas.data` | core | — | Planned | Optional wrapper for backend atlas data contract |
| `docs.route-manifest` | core | — | Planned | Plugin-generated page routes and labels |
| `openapi.partial.deno-functions` | plugin-deno-functions | 1.0.0 | Active | Deno functions partial OpenAPI spec (consumed by core docs) |
| `openapi.partial.<plugin>` | (producing plugin) | — | Convention | Plugin partial OpenAPI specs; merged deterministically |
| `migration.analysis` | plugin-migration-audit | 1.0.0 | Active | Migration audit result; per-migration sqlAnalysis; consumed by migration-studio |
| `migration.lineage` | plugin-migration-audit | — | Planned | Migration dependency/lineage graph |
| `migration.staleness` | plugin-migration-audit | — | Planned | Staleness and drift metrics |
| `migration.studio.draft` | plugin-migration-studio | — | Planned | Studio-owned draft migration metadata |
| `studio.schema.snapshot` | plugin-migration-studio | 1.0.0 | Active | Live DB state — tables, columns, constraints, indexes, policies, functions, views, triggers, extensions |
| `studio.sql.ast` | plugin-migration-studio | 1.0.0 | Active | Migration file parse results — per-file AST, extracted intent nodes, aggregated entity/policy/function arrays |
| `studio.intent.sync-report` | plugin-migration-studio | 1.0.0 | Active | Confidence-scored match between DB snapshot and SQL AST; matched, unmatchedDb, unmatchedIntent lists |
| `studio.intent.graph` | plugin-migration-studio | 1.0.0 | Active | Final intent graph — managed/assisted/opaque entity nodes, opaque blocks, managed scope declaration |
| `studio.rls.plan` | plugin-migration-studio | 1.0.0 | Planned | RLS policy plan for managed entities |
| `studio.rls.report` | plugin-migration-studio | 1.0.0 | Planned | RLS policy application report |
| `studio.rpc.plan` | plugin-migration-studio | 1.0.0 | Planned | RPC/function generation plan |
| `studio.migration.plan` | plugin-migration-studio | 1.0.0 | Planned | Migration generation plan from intent graph diff |
| `studio.migration.lint` | plugin-migration-studio | 1.0.0 | Planned | Migration lint results (destructive ops, missing transactions, etc.) |
| `studio.release.gate` | plugin-migration-studio | 1.0.0 | Planned | Release gate decision — go/no-go with blocking issues |
| `studio.workflow.run` | plugin-migration-studio | 1.0.0 | Active | Workflow run state — step results, status, timestamps, current step pointer |
| `typescript.schema-types` | plugin-typegen | — | Optional | Typegen output metadata (path, hash, timestamp) |
| `depgraph.graph` | plugin-depgraph | 1.0.0 | Producing | Dependency graph |
| `frontend.usage` | plugin-frontend-usage | 1.0.0 | Producing | Frontend usage scan results |
| `runtime.service-health` | plugin-logs | — | Optional | Runtime service health snapshots |
| `runtime.query-stats` | plugin-logs | — | Optional | Query statistics snapshots |

## Adding a new artifact

1. Propose the ID and schema in a PR.
2. Add a row to this registry with owner, schema version, status, and description.
3. Add a schema file and examples per the [contract guide](./artifact-contract-guide.md).
4. Ensure contract tests for producer and consumer.

## Deprecation

When deprecating an artifact:

1. Publish a new major artifact schema with migration notes.
2. Block incompatible consumers in CI/integration tests.
3. Remove the deprecated major after the documented cutover release.
4. Update this registry with deprecation status and removal date.
