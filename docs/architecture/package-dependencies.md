# Package & Artifact Dependencies

Dependency map for all 13 packages (sdk + core + ui-web + 10 plugins): npm dependencies, artifact produce/consume, filesystem I/O, and command flows. Use this to understand real-time update requirements (e.g. Migration Studio needs fresh `migration.analysis` to show migration list/status).

**Note:** `@sbtools/plugin-atlas-html` and `@sbtools/plugin-docs-server` were previously separate packages but have been merged into `@sbtools/core` as of v0.3.0. The `atlas-html` and `docs` commands are now built-in.

## NPM Package Dependencies

| Package | Depends On |
|---------|------------|
| `@sbtools/sdk` | — |
| `@sbtools/ui-web` | `react`, `react-dom` |
| `@sbtools/core` | `@sbtools/sdk`, `@sbtools/ui-web`, `dotenv`, `pg`, `zod` |
| `@sbtools/plugin-migration-studio` | `@sbtools/sdk`, `@sbtools/ui-web`, `pg`, `@codemirror/*` |
| `@sbtools/plugin-migration-audit` | `@sbtools/sdk`, `@sbtools/ui-web`, `pg` |
| `@sbtools/plugin-deno-functions` | `@sbtools/sdk` |
| `@sbtools/plugin-depgraph` | `@sbtools/sdk`, `@sbtools/ui-web` |
| `@sbtools/plugin-erd` | `@sbtools/sdk`, `pg` |
| `@sbtools/plugin-typegen` | `@sbtools/sdk` |
| `@sbtools/plugin-db-test` | `@sbtools/sdk`, `pg`, `@electric-sql/pglite` |
| `@sbtools/plugin-logs` | `@sbtools/sdk`, `@sbtools/ui-web` |
| `@sbtools/plugin-frontend-usage` | `@sbtools/sdk`, `@sbtools/ui-web` |
| `@sbtools/plugin-scaffold` | `@sbtools/sdk` |

## Artifact Produce / Consume

| Package | Produces | Consumes |
|---------|----------|----------|
| plugin-migration-studio | `migration.studio.draft` (planned) | `migration.analysis` |
| plugin-migration-audit | `migration.analysis` | — |
| @sbtools/core (docs) | — | `openapi.partial.deno-functions` |
| plugin-deno-functions | `openapi.partial.deno-functions` | — |
| plugin-depgraph | `depgraph.graph` | — |
| plugin-frontend-usage | `frontend.usage` | — |

## Artifact Write Triggers

| Artifact | Producer | Trigger |
|----------|----------|---------|
| `migration.analysis` | plugin-migration-audit | `sbt migration-audit` only (not `generate-atlas`) |
| `openapi.partial.deno-functions` | plugin-deno-functions | `sbt edge-functions` or `sbt generate-atlas` |
| `depgraph.graph` | plugin-depgraph | `sbt depgraph` |
| `frontend.usage` | plugin-frontend-usage | `sbt frontend-usage` |

## Command → Output Chain

```
sbt snapshot
  → supabase/current/ (full snapshot)

sbt generate-atlas
  → reads: supabase/current/ + all plugins getAtlasData
  → writes: docs/backend-atlas-data.json

sbt atlas-html
  → reads: docs/backend-atlas-data.json
  → writes: docs/backend-atlas.html

sbt migration-audit
  → reads: supabase/migrations/, DB
  → writes: migration.analysis artifact, docs/migration-audit.html

sbt depgraph
  → reads: docs/backend-atlas-data.json, supabase/current/, types.ts
  → writes: depgraph.graph artifact, docs/dependency-graph.html, .md

sbt edge-functions
  → reads: supabase/functions/
  → writes: openapi.partial.deno-functions artifact (when functions exist)

sbt frontend-usage
  → reads: src/ (or configured scanPaths)
  → writes: frontend.usage artifact, docs/frontend-usage.html

sbt docs [swagger|redoc|atlas|schemaspy|all]
  → reads: .sbt/openapi-spec.json, openapi.partial.* artifacts
  → serves: Swagger, ReDoc, Atlas, SchemaSpy

sbt watch --scope migration
  → listens: Postgres NOTIFY (sbt_watch_events), migrations dir changes
  → runs: sbt migration-audit --no-open (debounced)
  → writes: migration.analysis artifact, .sbt/watch/last-event.json
  → signals: migration-studio /api/events (SSE)
```

## Migration Studio Dependencies (Real-Time Updates)

| Studio Feature | Data Source | How to Refresh |
|----------------|-------------|----------------|
| Migrations list + status | `migration.analysis` artifact | Run `sbt migration-audit` |
| Schema: Database | Live DB | Connect to DB |
| Schema: Cached atlas | `docs/backend-atlas-data.json` | Run `sbt generate-atlas` |
| Schema: Table names only | `migration.analysis` (fallback) | Run `sbt migration-audit` |
| Schema: None | — | No snapshot/atlas/artifact |

**Important:** The `migration.analysis` artifact is written **only** by `sbt migration-audit`. Running `sbt generate-atlas` does **not** write it (migration-audit's `getAtlasData` contributes to atlas data but skips artifact write).

| Goal | Commands |
|------|----------|
| Show migrations list with status | `sbt migration-audit` |
| Rich schema from cache | `sbt generate-atlas` |
| Full schema from DB | Connect Studio to DB |
| Both migrations list and atlas schema | `sbt migration-audit` + `sbt generate-atlas` |

## File Inputs by Consumer

| Consumer | Inputs |
|----------|--------|
| **core** snapshot | DB (live) |
| **core** generate-atlas | `supabase/current/` + all plugins `getAtlasData` |
| **core** atlas-html | `docs/backend-atlas-data.json` |
| **core** docs | `.sbt/openapi-spec.json`, `openapi.partial.deno-functions` artifact |
| plugin-depgraph | `docs/backend-atlas-data.json`, `supabase/current/`, `types.ts` |
| plugin-migration-audit | `supabase/migrations/`, DB |
| plugin-migration-studio | `supabase/migrations/`, DB, `docs/backend-atlas-data.json`, `migration.analysis` artifact |

## Related

- [Artifact ID Registry](./artifact-registry.md) — Official artifact IDs
- [Implicit File Contracts](./implicit-file-contracts.md) — Output paths and merge semantics
