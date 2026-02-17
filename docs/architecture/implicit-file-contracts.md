# Implicit File Contracts and Output Paths

This document catalogs the implicit file conventions used by core and plugins. These are real but undocumented contracts. Prefer versioned artifacts (`.sbt/artifacts/`) for cross-plugin data sharing.

## Core output paths

| Path | Producer | Purpose |
|------|----------|---------|
| `{docsOutput}/backend-atlas-data.json` | `sbt generate-atlas` | Atlas JSON data; plugins contribute via `getAtlasData` |

## Plugin output paths (by convention)

| Path | Producer | Purpose |
|------|----------|---------|
| `{docsOutput}/migration-audit.html` | plugin-migration-audit | Full migration audit report |
| `{docsOutput}/migration-audit/<slug>.html` | plugin-migration-audit | Per-migration detail pages (SQL viewer, operations, risk) |
| `{docsOutput}/entity-relations/*.md` | plugin-erd | Mermaid ERD diagrams |
| `{docsOutput}/openapi-spec.json` | core (docs) | Merged OpenAPI spec |

## Artifact paths (versioned, preferred)

| Path | Artifact ID | Purpose |
|------|-------------|---------|
| `.sbt/artifacts/migration.analysis/1.0.0/latest.json` | migration.analysis | Migration audit result |
| `.sbt/artifacts/depgraph.graph/1.0.0/latest.json` | depgraph.graph | Dependency graph |
| `.sbt/artifacts/openapi.partial.deno-functions/1.0.0/latest.json` | openapi.partial.deno-functions | Deno functions OpenAPI partial |
| `.sbt/artifacts/frontend.usage/1.0.0/latest.json` | frontend.usage | Frontend SDK usage scan |

See [artifact registry](./artifact-registry.md) for the full contract set.

## Merge semantics

- **Atlas categories**: Plugins add keys to `data.categories`. Key collision overwrites previous value. Use unique, namespaced keys (e.g. `migration_audit`, not `migrations`).
- **Atlas stats**: Stats are appended; `countKey` collision updates `meta.object_counts`. Use lowercase-with-underscores for labels to avoid collision.
- **Dashboard**: Plugins contribute sections via `getDashboardView()` returning JSON-serializable `DashboardSectionDef[]`.
- **OpenAPI**: Deep merge of paths/components. Path collisions are overwritten; plugin should namespace or avoid PostgREST paths.

## Migration path

New plugins should use versioned artifacts for data sharing. Atlas/OpenAPI hooks remain for UI integration but should use unique, prefixed identifiers.
