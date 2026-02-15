# Migration Platform Architecture and Feature Implementation Plan

Status: Draft plan (no code implementation in this document)  
Owner: Platform / Plugin architecture  
Scope: Cross-plugin architecture hygiene + migration insights roadmap

See also: `VERSIONED_ARTIFACTS_ADOPTION_PLAN.md` for the contract system and 13-package retrofit roadmap.

---

## 1) Purpose

This document defines a comprehensive, incremental plan to implement:

1. **Migration detail explorer** (open migration and inspect SQL + analysis in browser)
2. **Object staleness and lineage** (tell whether a migration change is now outdated relative to current DB state)
3. **Migration authoring studio** (UI for creating migrations with analysis/templates/low-code helpers, then applying via core flow)

while preserving the existing philosophy:

- modular plugins instead of monolithic package
- strict separation of concerns
- minimal coupling between packages
- explicit contracts for collaboration

This plan also includes **architectural hygiene fixes** and consistency improvements observed in the current codebase.

---

## 2) Goals and non-goals

## Goals

- Keep plugins independently evolvable.
- Avoid direct plugin-to-plugin code imports.
- Replace implicit coupling with explicit, versioned contracts.
- Provide high-value backend insight UX for migrations.
- Ensure authoring workflows reuse core migration apply behavior.
- Improve reliability of Atlas/docs collaboration across plugins.

## Non-goals

- No immediate major rewrite of core command architecture.
- No attempt to make all existing plugins adopt new contracts in one release.
- No DB schema modifications by audit-style insight features.
- No immediate full SQL parser rewrite if regex-based classifier can be safely phased in.

---

## 3) Current-state coupling assessment

## What is already good

- Low compile-time coupling between plugins (plugins generally depend on `@sbtools/sdk`, not each other).
- Runtime plugin loading is dynamic in core (`plugin-loader`), preserving modularity.
- Shared integration points already exist (`getAtlasData`, `getAtlasUI`, `getStatusLines`, `getOpenApiSpec`).

## Current coupling pressure points

1. **Implicit file contracts**
   - Plugins rely on fixed output filenames (`backend-atlas-data.json`, `backend-atlas.html`, `migration-audit.html`, etc.).
   - Contract is real but undocumented and unversioned.

2. **Sibling plugin direct-object coupling**
   - `ctx.siblingPlugins` exposes plugin objects without typed capability negotiation.
   - Cross-plugin invocation contexts can be ambiguous.

3. **Atlas UI global merge coupling**
   - JS/CSS strings from multiple plugins are concatenated in one global page scope.
   - Potential for global function/id collisions and accidental override.

4. **Merge collision risks**
   - Atlas category/stat key collisions can overwrite data.
   - OpenAPI merge may collide paths/components without deterministic conflict policy.

## Architecture/documentation inconsistencies to fix

- Plugin `index.ts` versions are inconsistent with package versions.
- Namespace comments use mixed `@sbt/*` and `@sbtools/*` prefixes.
- Docs mention fields not present in current SDK type shape (example: `paths.tests`).
- Plugin API docs mention older command naming in places.
- A few behavior contracts are de facto but not explicitly documented (e.g., expected artifact paths, merge semantics).

---

## 4) Target architecture principles

## Principle A: share contracts, not internals

- Plugins **must not** import each other.
- Collaboration happens through:
  1. SDK hook contracts
  2. versioned artifacts
  3. optional capability registry metadata

## Principle B: explicit versioned artifacts

Introduce a standardized artifact envelope persisted under `.sbt/artifacts/`:

```json
{
  "id": "migration.analysis",
  "version": "1.0.0",
  "producer": "@sbtools/plugin-migration-audit",
  "generatedAt": "2026-02-15T00:00:00.000Z",
  "inputs": {
    "migrationsHash": "...",
    "snapshotTimestamp": "...",
    "dbTrackingHash": "..."
  },
  "data": {}
}
```

## Principle C: producer/consumer decoupling

- Producer plugin emits artifact.
- Consumer plugin reads artifact by contract id+version.
- Consumers never rely on producer internal APIs.

## Principle D: namespaced UI contributions

- Unique prefixed function names in injected JS.
- Unique section IDs/CSS classes.
- Namespaced category keys to prevent collision.

## Principle E: orchestration in core, domain logic in plugins

- Core coordinates lifecycle.
- Domain ownership remains with plugins (audit, studio, depgraph, etc.).

---

## 5) Package responsibilities after implementation

## `@sbtools/core`

- plugin loading/orchestration
- command routing
- artifact utility primitives (optional: via SDK)
- collision warnings and merge safeguards

## `@sbtools/sdk`

- plugin interfaces
- typed artifact envelope utilities and validators
- shared helper APIs (file writes, flags, UI)

## `@sbtools/plugin-migration-audit`

- migration read-only analysis
- migration detail pages
- object lineage/staleness classification
- audit HTML and Atlas insights
- artifact producer for migration analysis/lineage

## `@sbtools/plugin-migration-studio` (new)

- migration authoring UI
- templates/low-code builders
- live analysis using shared contracts/artifacts
- explicit apply flow invoking core migrate command path

## `@sbtools/plugin-atlas-html`

- atlas page assembly only
- plugin UI host and rendering container
- no domain-specific migration parsing logic

## `@sbtools/plugin-docs-server`

- serving generated docs assets
- no migration analysis logic

---

## 6) Proposed contract and artifact set (v1)

## A. `snapshot.object-index.v1`

Producer: snapshot pipeline (core or dedicated producer helper)  
Purpose: normalized map of current DB objects and canonical definitions.

Minimum fields:

- `objectKey` (kind + schema + name/identity)
- `kind` (`function`, `table`, `policy`, `trigger`, `view`, `type`, `enum`, ...)
- `canonicalDefinition` (normalized SQL/hash)
- `snapshotSourceFile` and `snapshotTimestamp`

## B. `migration.analysis.v1`

Producer: migration-audit  
Purpose: per migration parsed operations and safety/risk metadata.

Minimum fields:

- migration file metadata
- operation list (create/alter/drop/replace/etc.)
- touched object keys
- risk flags (destructive, transaction presence, idempotency indicators)
- parser confidence score

## C. `migration.lineage.v1`

Producer: migration-audit  
Purpose: object lifecycle timeline across migrations.

Minimum fields:

- `objectKey -> timeline[]`
- first introducing migration
- latest modifying migration
- drop migration (if any)

## D. `migration.staleness.v1`

Producer: migration-audit  
Purpose: migration-to-current-state relevance classification.

Status enum:

- `current`
- `outdated_modified_later`
- `outdated_dropped_later`
- `drift_untracked`
- `unknown`

## E. `migration.studio.draft.v1` (optional initial)

Producer: migration-studio  
Purpose: saved draft state and generated SQL metadata.

---

## 7) Incremental implementation roadmap

Implementation is designed as small, reversible phases.

## Phase 0 - Architecture hygiene and consistency baseline

Objective: eliminate preventable inconsistency before adding new features.

Steps:

1. Align plugin `index.ts` `version` fields with package versions or remove hardcoded duplication in favor of build-time injection.
2. Normalize naming references (`@sbtools/*` consistently).
3. Fix docs/type drift (PluginContext path list, command naming references).
4. Document current implicit file contracts in one central doc.
5. Add warning logs for Atlas/OpenAPI collision cases.

Deliverables:

- hygiene PR(s)
- updated docs and contributor notes
- basic consistency checklist

Acceptance criteria:

- no namespace mismatch in comments/docs
- no documented field mismatch in SDK docs
- collision warning path exists for atlas category/stat merge

---

## Phase 1 - Contract foundation (artifact layer)

Objective: establish decoupled collaboration mechanism.

Steps:

1. Add artifact envelope schema and validation helpers in SDK.
2. Add helper APIs for read/write artifact with id+version addressing.
3. Define artifact directory conventions (`.sbt/artifacts/<id>/<version>/...`).
4. Add lightweight capability metadata model:
   - optional `provides[]`
   - optional `consumes[]` (required/optional)
5. Add docs for contract lifecycle and compatibility policy.

Deliverables:

- SDK artifact primitives
- contract documentation
- migration path for existing plugins (non-breaking)

Acceptance criteria:

- plugins can publish/read artifact envelopes without direct dependencies
- version mismatch and missing-artifact behavior are explicit and safe

---

## Phase 2 - Migration analysis engine hardening (read-only)

Objective: evolve migration-audit parser model for downstream features.

Steps:

1. Introduce operation classifier for major DDL/DCL categories:
   - tables, functions, views, triggers, policies, extensions, indexes, constraints
2. Add safety/risk extraction:
   - transaction presence
   - IF EXISTS / IF NOT EXISTS
   - destructive operation detection
3. Produce `migration.analysis.v1` artifact.
4. Add parser confidence and fallback rules to avoid false certainty.

Deliverables:

- richer JSON output from migration-audit
- analysis artifact persisted

Acceptance criteria:

- each migration includes touched objects + operation summary
- parser produces deterministic output for baseline migration fixtures

---

## Phase 3 - Feature 1: Migration detail explorer

Objective: open migration entries in browser and inspect SQL + analysis.

Steps:

1. Add migration detail page generation in migration-audit output directory.
2. Link cards/table rows to detail pages.
3. Include:
   - full SQL viewer
   - operation summary chips
   - risk panel
   - status (applied/pending/missing)
4. Keep Atlas contribution lightweight (summary + link), avoid embedding huge SQL in atlas data payload.

Deliverables:

- migration detail HTML pages
- updated migration-audit index/report linking to detail pages

Acceptance criteria:

- clicking migration from report opens detailed analysis page
- page renders without requiring DB connectivity if artifact exists

---

## Phase 4 - Feature 3: Object staleness and lineage

Objective: compare old migration effects against current object state.

Steps:

1. Build object identity normalization rules:
   - functions include identity args
   - policy/trigger naming keyed by schema.table.name
2. Create timeline index from all migration operations.
3. Correlate with snapshot object index.
4. Classify staleness per object and per migration:
   - current/outdated/drift/unknown
5. Add UI sections:
   - object lifecycle timeline
   - "latest changed by" references
   - optional side-by-side definition diff view

Deliverables:

- `migration.lineage.v1`
- `migration.staleness.v1`
- lineage/staleness UI in migration detail view

Acceptance criteria:

- old migration that introduced object later altered shows outdated status
- dropped object path is correctly flagged
- stale snapshot condition shows explicit confidence warning

---

## Phase 5 - New plugin scaffold: `plugin-migration-studio`

Objective: separate write-path authoring from read-only audit.

Steps:

1. Create new plugin package with command `migration-studio`.
2. Implement local HTTP server and UI shell.
3. Add APIs:
   - analyze SQL (consume `migration.analysis` rules)
   - generate migration file
   - save draft
   - list templates
4. Enforce explicit confirmation for apply actions.
5. Apply path uses core migration execution flow (`sbt migrate`), no duplicate migration engine.

Deliverables:

- new plugin package and README
- initial authoring UI with raw SQL-first workflow

Acceptance criteria:

- author can create migration file from UI and save to migrations path
- apply requires confirmation and streams command output

---

## Phase 6 - Feature 2 extension: low-code/no-code helpers

Objective: accelerate migration authoring while preserving SQL transparency.

Steps:

1. Introduce template catalog:
   - table with RLS
   - index creation
   - function/RPC
   - trigger + function skeleton
2. Optional drag-and-drop block model producing deterministic SQL snippets.
3. Always show generated SQL in editable form.
4. Run live analysis and risk checks after each template/block update.

Deliverables:

- template framework
- starter templates
- block-to-SQL generator

Acceptance criteria:

- template-generated migrations are editable SQL, not opaque metadata
- analysis updates instantly and matches migration-audit semantics

---

## Phase 7 - Atlas/docs integration hardening

Objective: keep cross-plugin UX rich without tight coupling.

Steps:

1. Add route manifest contract for plugin-generated pages.
2. Replace hardcoded file links where possible with manifest lookup.
3. Namespace injected renderer symbols and section IDs.
4. Add dedupe/validation for atlas category and stats keys.
5. Add deterministic merge policy for OpenAPI collisions with warnings.

Deliverables:

- route manifest support
- safer Atlas merge and UI injection model

Acceptance criteria:

- no global function collisions from plugin JS
- duplicate keys produce deterministic outcome + warning

---

## Phase 8 - Testing, observability, and release rollout

Objective: ship safely and maintain confidence.

Steps:

1. Add fixture-based tests for migration parser and staleness classifier.
2. Add integration tests for artifact read/write lifecycle.
3. Add smoke tests:
   - generate-atlas + atlas-html with multiple plugins enabled
   - migration-audit detail links
   - migration-studio create + apply dry run
4. Add status diagnostics for artifact freshness and missing dependencies.
5. Publish rollout notes and migration guide for plugin authors.

Deliverables:

- test coverage for new contracts and features
- release notes and docs updates

Acceptance criteria:

- end-to-end path works in disk-only and DB-connected modes
- backward compatibility maintained for users not enabling new plugins

---

## 8) Decoupling guardrails (must-follow)

1. No plugin imports another plugin package directly.
2. All cross-plugin data sharing must use versioned contracts/artifacts.
3. UI plugins consume summarized data only; heavy payloads stay in dedicated pages.
4. Any new shared contract requires:
   - schema
   - versioning policy
   - producer/consumer docs
5. Prefer additive contracts over breaking changes.
6. Every plugin-owned output page should be namespaced under plugin output subdir.
7. Apply/write actions must remain explicit and user-confirmed.

---

## 9) Risk register and mitigations

## Risk: parser false positives/false negatives

Mitigation:

- parser confidence scoring
- conservative classification defaults
- clear "unknown" state in UI
- fixture regression tests

## Risk: stale snapshot causes misleading staleness results

Mitigation:

- snapshot timestamp freshness warnings
- "re-run snapshot" suggestion in UI
- classify confidence based on snapshot age

## Risk: global Atlas JS/CSS conflicts

Mitigation:

- plugin symbol namespacing
- section ID prefix enforcement
- optional future sandboxed renderer strategy

## Risk: contract fragmentation

Mitigation:

- central contract registry doc
- compatibility matrix per version
- deprecation policy and grace windows

---

## 10) Suggested execution order (small PR sequence)

1. Hygiene pass (version/docs/naming consistency)
2. Artifact framework in SDK/core docs
3. Migration analysis enrichment in audit plugin
4. Migration detail explorer UI
5. Staleness + lineage with snapshot correlation
6. New migration-studio plugin baseline
7. Template/low-code enhancements
8. Atlas/docs hardening and collision controls
9. Final docs and rollout polish

---

## 11) Definition of done

This roadmap is complete when:

- all three requested feature areas are delivered
- architectural coupling is contract-based and documented
- plugin boundaries remain clear (read-only audit vs write-capable studio)
- Atlas/docs integrations are robust and collision-aware
- contributors can add future plugins/features without hidden dependency chains

---

## 12) Notes for implementation kickoff

- Start with hygiene and contract groundwork before adding new UI complexity.
- Keep migration-audit and migration-studio as distinct trust boundaries.
- Ensure every milestone can ship independently with clear user value.
- Prefer incremental releases over one large refactor.

