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

1. dual-write old + new versions for one release window
2. emit warning for old version consumers
3. remove deprecated version after documented grace period

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

1. `atlas.data.v1` (optional wrapper for backend atlas data contract)
2. `docs.route-manifest.v1` (plugin-generated page routes and labels)
3. `openapi.partial.<plugin>.v1` (plugin partial specs; merged deterministically)

## Migration ecosystem artifacts

4. `snapshot.object-index.v1`
5. `migration.analysis.v1`
6. `migration.lineage.v1`
7. `migration.staleness.v1`
8. `migration.studio.draft.v1` (studio-owned)

## Optional supporting artifacts

9. `typescript.schema-types.v1` (typegen output metadata + path/hash)
10. `depgraph.graph.v1`
11. `frontend.usage.v1`
12. `runtime.service-health.v1`
13. `runtime.query-stats.v1`

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
- implement migration path: legacy file contracts remain supported

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

- produce `migration.analysis.v1`
- produce `migration.lineage.v1`
- produce `migration.staleness.v1`
- consume `snapshot.object-index.v1` if available (fallback to legacy snapshot files)

Priority: P1

---

## 8.4 `@sbtools/plugin-atlas-html` (Tier A)

Role:

- Atlas page assembler

Adoption:

- consume `docs.route-manifest.v1` for robust linking
- consume namespaced atlas contribution metadata
- enforce renderer symbol/id namespacing rules
- warn on duplicate category keys and kind labels

Priority: P1

---

## 8.5 `@sbtools/plugin-docs-server` (Tier A)

Role:

- docs serving and OpenAPI merge host

Adoption:

- consume `docs.route-manifest.v1` to avoid hardcoded assumptions
- consume `openapi.partial.*` artifacts (when present) in deterministic merge order
- emit warnings on path/component conflict

Priority: P1

---

## 8.6 `@sbtools/plugin-scaffold` (Tier A)

Role:

- future plugin generation baseline

Adoption:

- scaffold optional artifact producer/consumer boilerplate
- scaffold namespaced IDs/functions for Atlas UI
- scaffold contract test templates

Priority: P1

---

## 8.7 `@sbtools/plugin-depgraph` (Tier B)

Role:

- dependency graph producer + Atlas contributor

Adoption:

- optionally consume `atlas.data.v1` instead of direct hardcoded file reliance
- produce `depgraph.graph.v1` artifact for reuse
- publish route metadata for its HTML page

Priority: P2

---

## 8.8 `@sbtools/plugin-deno-functions` (Tier B)

Role:

- edge functions metadata and partial OpenAPI producer

Adoption:

- produce `openapi.partial.deno-functions.v1`
- optionally produce `edge-functions.inventory.v1`
- docs server merges artifact instead of hook-only path over time

Priority: P2

---

## 8.9 `@sbtools/plugin-frontend-usage` (Tier B)

Role:

- frontend usage scan producer

Adoption:

- produce `frontend.usage.v1`
- optionally publish route manifest entry for report page

Priority: P2

---

## 8.10 `@sbtools/plugin-logs` (Tier B)

Role:

- runtime diagnostics producer

Adoption:

- optional periodic `runtime.service-health.v1` and `runtime.query-stats.v1`
- do not force artifacts for always-live streaming paths; keep artifacts for snapshot-style reporting only

Priority: P3

---

## 8.11 `@sbtools/plugin-typegen` (Tier C)

Role:

- type generation command

Adoption:

- optional `typescript.schema-types.v1` metadata artifact:
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

- optional `erd.outputs.v1` route/index artifact for docs/atlas linkage
- no heavy adoption required unless ERD becomes a primary downstream dependency

Priority: P4

---

## 8.13 `@sbtools/plugin-db-test` (Tier C)

Role:

- test execution plugin

Adoption:

- optional `db-test.last-run.v1` summary artifact
- optional consume `migration.analysis.v1` for pre-test advisory checks
- keep core test flow independent of artifact availability

Priority: P4

---

## 9) Incremental rollout plan (waves)

## Wave 0 - Documentation and governance

Deliver:

- architecture spec (this document)
- artifact ID registry doc
- compatibility policy and contributor checklist

Gate:

- team signs off on contract ownership and naming conventions

---

## Wave 1 - Foundation in SDK + core

Deliver:

- envelope types + validation helpers
- artifact read/write APIs
- default storage conventions
- feature flags for rollout:
  - `SBT_ARTIFACTS_WRITE=1`
  - `SBT_ARTIFACTS_READ=1`
  - `SBT_ARTIFACTS_STRICT=1` (future)

Gate:

- no behavior regression when flags disabled

---

## Wave 2 - High-value migration path

Deliver:

- migration-audit produces analysis/lineage/staleness artifacts
- migration detail pages consume these artifacts
- Atlas links via route manifest where available

Gate:

- old flows keep working (legacy report generation untouched)

---

## Wave 3 - Atlas/docs consumers

Deliver:

- atlas-html route manifest consumption and namespacing enforcement
- docs-server openapi/artifact merge path + conflict reporting

Gate:

- deterministic merge outputs in integration tests

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

- dual-read/dual-write migration completion
- deprecate fragile implicit assumptions gradually
- formalize warning-to-error timeline for strict mode

Gate:

- published migration guide for plugin maintainers

---

## 10) Backward compatibility approach

## Dual-write policy

Producers write:

1. legacy output (existing behavior)
2. new artifact envelope

for at least one stable release cycle.

## Dual-read policy

Consumers prefer artifacts if available; fallback to legacy files/hooks.

## Strict mode policy

Only after adoption maturity:

- strict mode can require artifact presence and schema validity

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
- dual-read/dual-write grace period

---

## 12) Testing and quality gates

Minimum required:

1. schema validation tests per artifact
2. producer fixture tests (stable output snapshots)
3. consumer compatibility tests (unknown fields tolerated)
4. integration tests with mixed legacy + artifact mode
5. failure tests (missing, invalid, stale artifacts)

---

## 13) Work breakdown (implementation-level checklist)

## Checklist A - policy and docs

- [ ] add artifact ID registry document
- [ ] add contract authoring guide
- [ ] add compatibility policy to contributor docs

## Checklist B - SDK/core foundation

- [ ] envelope types + validators
- [ ] artifact filesystem helper module
- [ ] feature flags and logging behavior

## Checklist C - migration path

- [ ] migration-audit producer artifacts
- [ ] detail/staleness pages consume artifacts
- [ ] fallback behavior verified

## Checklist D - atlas/docs adoption

- [ ] route manifest contract
- [ ] conflict-safe merges
- [ ] namespaced renderer validation

## Checklist E - medium/optional plugins

- [ ] depgraph artifact output
- [ ] deno-functions openapi partial artifact
- [ ] frontend-usage artifact output
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
3. legacy file/hook assumptions are no longer single points of coupling
4. all adoption paths are backward-compatible and tested
5. plugin maintainers have clear guidance and scaffold support

---

## 16) Relationship to migration platform plan

This document complements:

- `MIGRATION_PLATFORM_IMPLEMENTATION_PLAN.md`

That plan focuses on migration features and platform outcomes.  
This plan defines the **cross-package contract system** needed to scale those features without creating monolithic coupling.

