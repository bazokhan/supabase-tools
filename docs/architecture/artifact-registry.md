# Artifact ID Registry

This document is the **single source of truth** for official artifact IDs in supabase-tools. All new artifact IDs must be registered here and follow the [artifact contract guide](./artifact-contract-guide.md).

## Naming rules

- `id` is stable and **never** includes version suffixes (e.g. `migration.analysis`, not `migration.analysis.v1`).
- Use dot-separated lowercase: `<domain>.<entity>` or `<domain>.<entity>.<plugin>`.
- Avoid duplicate semantics under different IDs.

## Official registry

| Artifact ID | Owner Package | Schema Version | Status | Description |
|-------------|---------------|----------------|--------|-------------|
| `atlas.data` | core | — | Planned | Optional wrapper for backend atlas data contract |
| `docs.route-manifest` | plugin-atlas-html, plugin-docs-server | — | Planned | Plugin-generated page routes and labels |
| `openapi.partial.deno-functions` | plugin-deno-functions | 1.0.0 | Active | Deno functions partial OpenAPI spec |
| `openapi.partial.<plugin>` | (producing plugin) | — | Convention | Plugin partial OpenAPI specs; merged deterministically |
| `snapshot.object-index` | core | — | Planned | Snapshot object index (canonical source for migration audit) |
| `migration.analysis` | plugin-migration-audit | 1.0.0 | Planned | Migration audit result: disk vs DB comparison |
| `migration.lineage` | plugin-migration-audit | — | Planned | Migration dependency/lineage graph |
| `migration.staleness` | plugin-migration-audit | — | Planned | Staleness and drift metrics |
| `migration.studio.draft` | (studio) | — | Planned | Studio-owned draft migration metadata |
| `typescript.schema-types` | plugin-typegen | — | Optional | Typegen output metadata (path, hash, timestamp) |
| `depgraph.graph` | plugin-depgraph | 1.0.0 | Active | Dependency graph |
| `frontend.usage` | plugin-frontend-usage | 1.0.0 | Active | Frontend usage scan results |
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
