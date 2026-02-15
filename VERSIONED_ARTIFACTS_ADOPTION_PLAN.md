# Versioned Artifacts: Architecture Specification and 13-Package Retrofit Plan

Status: Draft architecture + rollout plan (no code implementation in this document)  
Branch intent: same PR as migration platform planning  
Scope: Introduce and incrementally adopt versioned artifacts across existing monorepo packages where useful

---

## 1) Why this exists

The repository already has strong plugin modularity at compile time, but cross-plugin collaboration currently relies on:

- implicit file conventions
- hook-time object sharing (`siblingPlugins`)
- global merged UI snippets

These are practical but loosely coupled contracts. As features grow (especially migration analysis/lineage/studio), this needs stronger structure.

**Versioned artifacts** are the contract layer that keeps plugin boundaries independent while enabling rich collaboration.

---

## 2) Definition: versioned artifact

A versioned artifact is a persisted, typed, semantically-versioned envelope produced by one package and consumed by one or more others.

Core properties:

- explicit `id` and `version`
- known producer
- deterministic schema
- input fingerprints (for freshness/staleness)
- safe backward compatibility strategy

### Canonical envelope (v1 proposal)

```json
{
  "id": "migration.analysis",
  "version": "1.0.0",
  "producer": "@sbtools/plugin-migration-audit",
  "generatedAt": "2026-02-15T00:00:00.000Z",
  "schemaRef": "https://sbtools.dev/contracts/migration.analysis/1.0.0",
  "inputs": {
    "projectRoot": "/workspace",
    "sourceHash": "sha256:...",
    "snapshotHash": "sha256:..."
  },
  "meta": {
    "toolVersion": "0.3.0",
    "buildId": "..."
  },
  "data": {}
}
```

### Storage convention

Recommended default:

`.sbt/artifacts/<artifact-id>/<semver>/latest.json`

Optional immutable snapshots:

`.sbt/artifacts/<artifact-id>/<semver>/<timestamp-or-hash>.json`

### Canonical identity + versioning rules

To remove ambiguity, artifact versioning is defined as:

1. `id` is stable and **never** includes version suffixes (`migration.analysis`, not `migration.analysis.v1`).
2. `version` is the only schema compatibility marker and must be full semver (`MAJOR.MINOR.PATCH`).
3. filesystem path mirrors the semver field: `.sbt/artifacts/<id>/<version>/latest.json`.

Examples:

- `id: "migration.analysis"`, `version: "1.2.0"` -> `.sbt/artifacts/migration.analysis/1.2.0/latest.json`
- `id: "openapi.partial.deno-functions"`, `version: "1.0.0"` -> `.sbt/artifacts/openapi.partial.deno-functions/1.0.0/latest.json`

Invalid patterns (prohibited):

- `id: "migration.analysis.v1"` with `version: "1.0.0"` (double versioning)
- path semver that does not match envelope semver

---

## 3) Contract lifecycle and compatibility policy

## Semver behavior

- `MAJOR`: breaking data schema changes
- `MINOR`: additive compatible fields
- `PATCH`: docs/bugfix semantics, no structural break

## Producer rules

- must validate output against schema before write
- must include freshness inputs
- must document confidence limits where relevant

## Consumer rules

- should read exact compatible major
- may accept newer minor if unknown fields are ignored
- must degrade gracefully when artifact is missing/stale

## Deprecation process

1. publish new major artifact schema with migration notes
2. block incompatible consumers in CI/integration tests
3. remove deprecated major after documented cutover release

---

## 4) Governance model

To avoid fragmented ad hoc artifacts:

1. Maintain a single registry doc of official artifact IDs.
2. Each new artifact ID requires:
   - owner package
   - schema file
   - examples
   - compatibility note
3. Prevent duplicate semantics under different IDs.
4. Require contract tests for producers and consumer fixtures.

---

## 5) Current monorepo package inventory (13 packages)

1. `@sbtools/core`
2. `@sbtools/sdk`
3. `@sbtools/plugin-atlas-html`
4. `@sbtools/plugin-db-test`
5. `@sbtools/plugin-deno-functions`
6. `@sbtools/plugin-depgraph`
7. `@sbtools/plugin-docs-server`
8. `@sbtools/plugin-erd`
9. `@sbtools/plugin-frontend-usage`
10. `@sbtools/plugin-logs`
11. `@sbtools/plugin-migration-audit`
12. `@sbtools/plugin-scaffold`
13. `@sbtools/plugin-typegen`

---

## 5.1) High-importance architecture contradictions to resolve early

The following contradictions are currently present across packages and should be treated as early blockers for artifact trust:

1. **Plugin version metadata drift**: several plugin `src/index.ts` versions diverge from package versions; artifact provenance cannot rely on inconsistent producer version fields.
2. **Direct hook coupling for collaboration**: runtime behavior still relies on `siblingPlugins`, `getOpenApiSpec`, and global Atlas UI string merges in primary paths.
3. **Collision ambiguity in merge hosts**: OpenAPI and Atlas merges currently need explicit conflict semantics to avoid silent overwrite behavior.
4. **Scaffold-generated legacy patterns**: generated plugins must default to artifact-first collaboration so new packages do not reinforce old coupling.

These must be addressed in Waves 0-3 before Tier B/C scale-out.

---

## 6) Retrofit strategy by priority tier

Not every package needs deep artifact adoption immediately. Apply where value is meaningful.

## Tier A (Immediate, high leverage)

- `core`
- `sdk`
- `plugin-migration-audit`
- `plugin-atlas-html`
- `plugin-docs-server`
- `plugin-scaffold`

## Tier B (Next wave, medium leverage)

- `plugin-depgraph`
- `plugin-deno-functions`
- `plugin-frontend-usage`
- `plugin-logs`

## Tier C (Selective/optional adoption)

- `plugin-typegen`
- `plugin-erd`
- `plugin-db-test`

---

## 7) Artifact catalog (initial target set)

## Foundational artifacts

1. `atlas.data` (optional wrapper for backend atlas data contract)
2. `docs.route-manifest` (plugin-generated page routes and labels)
3. `openapi.partial.<plugin>` (plugin partial specs; merged deterministically)

## Migration ecosystem artifacts

4. `snapshot.object-index`
5. `migration.analysis`
6. `migration.lineage`
7. `migration.staleness`
8. `migration.studio.draft` (studio-owned)

## Optional supporting artifacts

9. `typescript.schema-types` (typegen output metadata + path/hash)
10. `depgraph.graph`
11. `frontend.usage`
12. `runtime.service-health`
13. `runtime.query-stats`

---

## 8) 13-package adoption matrix

This section defines what each package should adopt, when, and why.

## 8.1 `@sbtools/core` (Tier A)

Role:

- orchestrator and lifecycle coordinator

Adoption:

- add artifact utility plumbing and default directories
- expose contract-safe read/write helpers (or route through SDK)
- add collision/freshness warnings
- enforce artifact directory/layout invariants from first implementation release
- stop introducing new implicit file contracts (artifact contracts are the default)

Priority: P0

---

## 8.2 `@sbtools/sdk` (Tier A)

Role:

- shared plugin contract and utilities

Adoption:

- define artifact envelope types and helper APIs
- schema validation helpers (runtime)
- producer/consumer convenience methods
- capability declaration types (optional fields in plugin contract)

Priority: P0

---

## 8.3 `@sbtools/plugin-migration-audit` (Tier A)

Role:

- producer of migration insights and lineage/staleness

Adoption:

- produce `migration.analysis`
- produce `migration.lineage`
- produce `migration.staleness`
- consume `snapshot.object-index` as the canonical source artifact for snapshot indexing

Priority: P1

---

## 8.4 `@sbtools/plugin-atlas-html` (Tier A)

Role:

- Atlas page assembler

Adoption:

- consume `docs.route-manifest` for robust linking
- consume namespaced atlas contribution metadata
- enforce renderer symbol/id namespacing rules
- warn on duplicate category keys and kind labels

Priority: P1

---

## 8.5 `@sbtools/plugin-docs-server` (Tier A)

Role:

- docs serving and OpenAPI merge host

Adoption:

- consume `docs.route-manifest` to avoid hardcoded assumptions
- consume `openapi.partial.*` artifacts in deterministic merge order
- apply explicit conflict policy (error/warn rules by OpenAPI section)

Priority: P1

---

## 8.6 `@sbtools/plugin-scaffold` (Tier A)

Role:

- future plugin generation baseline

Adoption:

- scaffold artifact producer/consumer boilerplate by default
- scaffold namespaced IDs/functions for Atlas UI
- scaffold contract test templates and schema fixture placeholders

Priority: P1

---

## 8.7 `@sbtools/plugin-depgraph` (Tier B)

Role:

- dependency graph producer + Atlas contributor

Adoption:

- consume `atlas.data` instead of direct hardcoded file reliance
- produce `depgraph.graph` artifact for reuse
- publish route metadata for its HTML page

Priority: P2

---

## 8.8 `@sbtools/plugin-deno-functions` (Tier B)

Role:

- edge functions metadata and partial OpenAPI producer

Adoption:

- produce `openapi.partial.deno-functions`
- optionally produce `edge-functions.inventory`
- docs server consumes artifacts as the primary integration path

Priority: P2

---

## 8.9 `@sbtools/plugin-frontend-usage` (Tier B)

Role:

- frontend usage scan producer

Adoption:

- produce `frontend.usage`
- optionally publish route manifest entry for report page

Priority: P2

---

## 8.10 `@sbtools/plugin-logs` (Tier B)

Role:

- runtime diagnostics producer

Adoption:

- optional periodic `runtime.service-health` and `runtime.query-stats`
- do not force artifacts for always-live streaming paths; keep artifacts for snapshot-style reporting only

Priority: P3

---

## 8.11 `@sbtools/plugin-typegen` (Tier C)

Role:

- type generation command

Adoption:

- optional `typescript.schema-types` metadata artifact:
  - output path
  - hash
  - generated timestamp
- useful to depgraph/other consumers without file probing heuristics

Priority: P3

---

## 8.12 `@sbtools/plugin-erd` (Tier C)

Role:

- ERD output producer

Adoption:

- optional `erd.outputs` route/index artifact for docs/atlas linkage
- no heavy adoption required unless ERD becomes a primary downstream dependency

Priority: P4

---

## 8.13 `@sbtools/plugin-db-test` (Tier C)

Role:

- test execution plugin

Adoption:

- optional `db-test.last-run` summary artifact
- optional consume `migration.analysis` for pre-test advisory checks
- keep core test flow independent of artifact availability

Priority: P4

---

## 9) Incremental rollout plan (waves)

## Wave 0 - Documentation and governance

Deliver:

- architecture spec (this document)
- artifact ID registry doc
- compatibility policy and contributor checklist
- plugin version-source alignment audit across all 13 packages

Gate:

- team signs off on contract ownership, naming conventions, and conflict policy semantics

---

## Wave 1 - Foundation in SDK + core

Deliver:

- envelope types + validation helpers
- artifact read/write APIs
- default storage conventions
- typed capability fields added to plugin contract
- core-provided artifact context injected into plugin runtime context

Gate:

- all Tier A packages can compile and run against the new SDK contract

---

## Wave 2 - High-value migration path

Deliver:

- migration-audit produces analysis/lineage/staleness artifacts
- migration detail pages consume these artifacts
- Atlas links via route manifest where available

Gate:

- migration detail and staleness views run entirely through declared artifact contracts

---

## Wave 3 - Atlas/docs consumers

Deliver:

- atlas-html route manifest consumption and namespacing enforcement
- docs-server openapi/artifact merge path + conflict reporting
- deterministic merge order rules (plugin ordering + explicit priority override support)

Gate:

- deterministic merge outputs in integration tests
- collision fixtures verify documented fail/warn behavior for OpenAPI paths/components/tags and Atlas identifiers

---

## Wave 4 - Medium-priority plugin producers

Deliver:

- depgraph, deno-functions, frontend-usage artifact emission
- optional logs snapshot artifacts

Gate:

- consumers can run without these artifacts (soft dependency)

---

## Wave 5 - Selective low-priority adoption

Deliver:

- optional typegen/erd/db-test metadata artifacts where ROI is justified

Gate:

- avoid artifact complexity where user-facing value is minimal

---

## Wave 6 - Hardening and deprecation

Deliver:

- remove remaining implicit contract assumptions
- formalize warning-to-error timeline for strict mode
- publish migration guide for plugin maintainers

Gate:

- all Tier A/B integrations validated as artifact-first in integration tests

---

## 10) Cutover policy (active development mode)

This repository is in active development; artifact adoption does not require preserving legacy contract paths.

## Default policy

- new cross-package integrations must be artifact-based
- new features should not add sibling-plugin hook coupling as a primary path
- strict schema validation is enabled in CI for official artifact IDs

## Cutover policy

- when a package adopts an artifact contract, consumer flows should switch to that contract directly
- if temporary adapters are required during implementation, they must be explicitly time-boxed in the same milestone

## Strict mode policy

- strict mode requires artifact presence, schema validity, and compatible major versions

---

## 11) Risks and mitigations

## Risk: over-engineering low-value paths

Mitigation:

- tiered adoption matrix
- optional artifacts for Tier C

## Risk: artifact sprawl and duplicate semantics

Mitigation:

- central registry + ownership model
- contract review checklist

## Risk: stale artifacts causing misleading UI

Mitigation:

- freshness metadata and staleness banners
- easy regeneration commands

## Risk: difficult transition for plugin maintainers

Mitigation:

- scaffold templates
- migration cookbook examples
- artifact-first cookbook examples and contract migration recipes

---

## 12) Testing and quality gates

Minimum required:

1. schema validation tests per artifact
2. producer fixture tests (stable output snapshots)
3. consumer compatibility tests (unknown fields tolerated)
4. integration tests for deterministic artifact-first flows
5. failure tests (missing, invalid, stale artifacts)

---

## 13) Work breakdown (implementation-level checklist)

## Checklist A - policy and docs

- [x] add artifact ID registry document
- [x] add contract authoring guide
- [x] add compatibility policy to contributor docs

## Checklist B - SDK/core foundation

- [x] envelope types + validators
- [x] artifact filesystem helper module
- [x] plugin contract extension for artifact capabilities
- [x] plugin version-source alignment check (index metadata vs package version)

## Checklist C - migration path

- [x] migration-audit producer artifacts
- [ ] detail/staleness pages consume artifacts
- [ ] artifact freshness and schema validation behavior verified

## Checklist D - atlas/docs adoption

- [ ] route manifest contract
- [x] conflict-safe merges (docs-server consumes openapi.partial.* artifacts)
- [ ] namespaced renderer validation

## Checklist E - medium/optional plugins

- [x] depgraph artifact output
- [x] deno-functions openapi partial artifact
- [x] frontend-usage artifact output
- [ ] optional logs/typegen/erd/db-test metadata artifacts

---

## 14) Ownership model (proposed)

- Artifact framework owner: `core + sdk` maintainers
- Migration artifacts owner: `plugin-migration-audit`
- Route manifest owner: `plugin-atlas-html` + `plugin-docs-server`
- OpenAPI partial owners: producing plugins (e.g. deno-functions)
- Governance owner: docs/architecture maintainers

---

## 15) Definition of done for this initiative

The versioned artifact initiative is considered complete when:

1. foundational contracts are in SDK/core and documented
2. high-value packages (Tier A/B) use artifact-based collaboration where it matters
3. implicit file/hook assumptions are removed from Tier A/B primary flows
4. all adoption paths are artifact-first and tested
5. plugin maintainers have clear guidance and scaffold support

---

## 16) Relationship to migration platform plan

This document complements:

- `MIGRATION_PLATFORM_IMPLEMENTATION_PLAN.md`

That plan focuses on migration features and platform outcomes.  
This plan defines the **cross-package contract system** needed to scale those features without creating monolithic coupling.
