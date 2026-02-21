# Migration Studio Platform — Status & Roadmap to 100%

> Last updated: 2026-02-20 (catalog expansion + persona roadmap update)
> This document is a living status report. Update the checkboxes and sections as work completes.

---

## The Vision

A **workflow-driven backend platform** that replaces raw SQL authoring with structured intent:

1. **Understand** what exists (introspect live DB + parse migrations → confidence-scored knowledge graph)
2. **Design** what should exist (visual schema builder, policy builder, function builder in the dashboard)
3. **Generate** atomic SQL from that intent (migration files, not raw editing)
4. **Validate** before applying (lint, RLS coverage check, release gate)
5. **Apply** with confidence (gate must pass; audit trail in artifacts)

The end state: a developer opens the dashboard, designs a table with columns and RLS policies through forms, clicks "Generate Migration", reviews the SQL in the editor, and applies it — without writing a line of SQL directly.

---

## Layer Map

The platform has five conceptual layers. Implementation status follows.

```
┌─────────────────────────────────────────────────────────────────┐
│ 5. APPLY        │ Gate check → sbt migrate → audit trail        │
├─────────────────┼─────────────────────────────────────────────────┤
│ 4. VALIDATE     │ RLS check, RPC lint, migration lint, release gate│
├─────────────────┼─────────────────────────────────────────────────┤
│ 3. GENERATE     │ Scaffold tools → migration files               │
├─────────────────┼─────────────────────────────────────────────────┤
│ 2. DESIGN       │ Visual builder UI (forms → intent → preview)   │
├─────────────────┼─────────────────────────────────────────────────┤
│ 1. UNDERSTAND   │ Introspect DB + parse migrations → intent graph │
└─────────────────┴─────────────────────────────────────────────────┘
```

---

## Current Status by Layer

### Layer 1 — Understand ✅ Complete

The "brownfield adoption" chain is fully implemented and tested.

| Component | File | Status |
|---|---|---|
| SQL parser (WASM) | `sql-parser.ts` | ✅ Done |
| DB introspect tool | `tools/modules/studio-introspect.tool.ts` | ✅ Done |
| Migration file parser | `tools/modules/studio-sql-parse.tool.ts` | ✅ Done |
| Confidence scorer | `tools/modules/studio-intent-sync.tool.ts` | ✅ Done |
| Intent graph builder | `tools/modules/studio-intent-init.tool.ts` | ✅ Done |
| Workflow engine | `engine/runner.ts` | ✅ Done |
| adopt-backend workflow | `workflows/adopt-backend.workflow.ts` | ✅ Done |
| `sbt studio-adopt` CLI | `index.ts` | ✅ Done |
| HTTP adopt routes | `server.ts` | ✅ Done |
| Dashboard Adoption page | `pages/Adoption.tsx` | ✅ Done (interactive — status badges, Exclude/Manage buttons) |
| Artifact writers + schemas | `artifacts/writers.ts` | ✅ Done |

**What works end-to-end today:** Run `sbt studio-adopt`, watch it introspect your live DB, parse your migration files, score confidence per entity, and produce an intent graph that classifies every table/function/policy as `managed`, `assisted`, or `opaque`.

**What works end-to-end in Phase 10:**
- `sbt studio-intent-patch --entity public.logs --action exclude` patches a single entity's classification and persists to disk
- `sbt studio-endpoint-map` derives `EndpointNode` declarations for all managed entities and public-schema functions
- The Adoption dashboard page is now interactive: color-coded status badges, "Manage" / "Exclude" buttons per row, "Map Endpoints" button with result count

---

### Layer 2 — Design ✅ Complete

A visual Schema Builder page exists at `/schema-builder` in the dashboard. It calls the existing scaffold HTTP routes on port 3335.

| Component | File | Status |
|---|---|---|
| Schema entity builder (new table form) | `pages/SchemaBuilder.tsx` | ✅ Done |
| RLS policy builder (visual form) | `pages/SchemaBuilder.tsx` | ✅ Done |
| Live SQL preview (client-side) | `pages/SchemaBuilder.tsx` | ✅ Done |
| Column editor (add/remove/change type) | `pages/SchemaBuilder.tsx` | ✅ Done (inline table) |
| Scaffold HTTP routes | `server.ts` | ✅ All 13 routes wired |
| Scaffold tools (backend) | `tools/modules/studio-*.tool.ts` + `tools/core/studio-*.core.ts` | ✅ All 8 tools |
| Function builder (form + body editor) | `pages/SchemaBuilder.tsx` | ✅ Done (Phase 11) |
| RPC builder (public schema, PostgREST) | `pages/SchemaBuilder.tsx` | ✅ Done (Phase 11) |
| View builder | `pages/SchemaBuilder.tsx` | ✅ Done (Phase 11) |
| Greenfield init (start with no DB) | `pages/SchemaBuilder.tsx` | ✅ Done (Phase 9) |
| Intent graph mutation from UI | `pages/Adoption.tsx` | ✅ Done (Phase 10 — entity row actions) |

**What works:** Open the dashboard at `/schema-builder` → fill in forms for any object type (table, RLS policy, function, RPC, view) → live SQL preview updates as you type → click "Generate Migration" → file written to disk → ready to apply. The Adoption page lets you reclassify entities directly and map endpoints.

---

### Layer 3 — Generate ✅ Complete

All scaffold tools are implemented. Each generates a migration SQL file and writes it to the migrations directory.

#### Scaffold tools

| Tool | File | Generates | Status |
|---|---|---|---|
| add-column | `tools/core/studio-add-column.core.ts` | `ALTER TABLE ... ADD COLUMN ...` | ✅ |
| add-function | `tools/core/studio-add-function.core.ts` | `CREATE OR REPLACE FUNCTION ...` | ✅ |
| create-rpc | `tools/core/studio-create-rpc.core.ts` | Same, forced `schema: public` | ✅ |
| create-table | `tools/core/studio-create-table.core.ts` | `CREATE TABLE ... ENABLE ROW LEVEL SECURITY` | ✅ (Phase 6) |
| add-rls-policy | `tools/core/studio-add-rls-policy.core.ts` | `CREATE POLICY ...` | ✅ (Phase 6) |
| add-index | `tools/core/studio-add-index.core.ts` | `CREATE INDEX ...` | ✅ (Phase 6) |
| add-constraint | `tools/core/studio-add-constraint.core.ts` | `ALTER TABLE ... ADD CONSTRAINT ...` | ✅ (Phase 6) |
| create-view | `tools/core/studio-create-view.core.ts` | `CREATE OR REPLACE VIEW ...` | ✅ (Phase 11) |

**Note on intent graph dependency:** `add-column` requires the intent graph. All other scaffold tools work without it. `create-table` optionally writes a minimal `EntityNode` after creation for greenfield bootstrap.

#### Workflow coverage

| Workflow | Steps | Status |
|---|---|---|
| `adopt-backend` | introspect → sql-parse → intent-sync (review) → intent-init (approve) | ✅ Done |
| `greenfield-init` | init-graph (empty) → Schema Builder forms → generate-create-table × N | ✅ Done (Phase 9) |
| `release-check` | rls-check → rpc-lint → migration-lint → release-gate | ✅ Cataloged |
| `create-table` | generate-create-table → migration-lint | ✅ Cataloged (guided) |
| `add-rls-policy` | generate-add-rls-policy → rls-check preview | ✅ Cataloged (guided) |

---

### Layer 4 — Validate ✅ Complete

All five validation tools are implemented, tested, wired to HTTP routes, and exposed as CLI commands.

| Artifact | Writer | Tool | CLI | HTTP | Status |
|---|---|---|---|---|---|
| `studio.rls.plan` | ✅ `writeRlsPlanArtifact` | ✅ `tools/rls-check.ts` | ✅ `studio-rls-check` | ✅ `POST /api/studio/rls-check` | Done |
| `studio.rls.report` | ✅ `writeRlsReportArtifact` | ✅ (same tool) | ✅ | ✅ | Done |
| `studio.rpc.plan` | ✅ `writeRpcPlanArtifact` | ✅ `tools/rpc-lint.ts` | ✅ `studio-rpc-lint` | ✅ `POST /api/studio/rpc-lint` | Done |
| `studio.migration.plan` | ✅ `writeMigrationPlanArtifact` | ✅ `tools/migration-plan.ts` | ✅ `studio-migration-plan` | ✅ `POST /api/studio/migration-plan` | Done |
| `studio.migration.lint` | ✅ `writeMigrationLintArtifact` | ✅ `tools/core/studio-migration-lint.core.ts` | ✅ `studio-lint` (alias: `studio-migration-lint`) | ✅ `POST /api/studio/migration-lint` | Done |
| `studio.release.gate` | ✅ `writeReleaseGateArtifact` | ✅ `tools/release-gate.ts` | ✅ `studio-release-gate` | ✅ `POST /api/studio/release-gate` | Done |

**What each tool does:**

- **`rls-check`** — Reads intent graph. For every managed entity, verifies SELECT/INSERT/UPDATE/DELETE policy coverage (ALL command counts for all). Flags SECURITY DEFINER functions without `search_path`. Produces `studio.rls.plan` (proposed policies) and `studio.rls.report` (coverage + gap analysis).

- **`rpc-lint`** — Reads all `FunctionNode` entries in intent graph. Checks: DEFINER_NO_SEARCH_PATH, DEFINER_PUBLIC_EXPOSURE (definer in public schema), EMPTY_FUNCTION_BODY. Skips opaque/excluded functions. Produces `studio.rpc.plan`.

- **`migration-plan`** — Diffs intent graph vs schema snapshot. Classifies each change as `additive_safe` / `additive_with_default` / `type_change_narrowing` / `drop` / `policy_change` / `constraint_change`. Sorts additive changes first, destructive last. Produces `studio.migration.plan` with a `snapshotHash`.

- **`migration-lint`** — Reads SQL AST artifact. Checks per migration file: TRUNCATE_DETECTED (error), DROP_DETECTED (warning), DESTRUCTIVE_NO_TRANSACTION (warning), LOW_PARSE_CONFIDENCE (info), NAMING_VIOLATION (non-timestamped filename). Produces `studio.migration.lint`.

- **`release-gate`** — Aggregates findings from RLS report, RPC plan, and migration lint (all optional). NO_VALIDATION if no evidence. RLS gaps and lint errors → blocking. All warnings → gate warnings. Produces `studio.release.gate` with pass/fail status.

---

### Layer 5 — Apply ✅ Complete

The core `sbt migrate` command and the migration studio's `POST /api/apply` route exist and work. Gate enforcement, snapshot staleness detection, and an audit log are all implemented.

| Component | Status | Notes |
|---|---|---|
| `sbt migrate` | ✅ Done | Core command, applies SQL files |
| `POST /api/apply` in studio | ✅ Done | Browser-triggered apply |
| Release gate enforcement at apply | ✅ Done | 422 block when `studio.release.gate` status is `fail`; warning header when no gate artifact |
| Snapshot staleness check | ✅ Done (Phase 11) | Reads `studio.migration.plan` hash, re-hashes current snapshot; returns `snapshotStale: true` if changed (non-blocking warning) |
| Audit artifact written on apply | ✅ Done (Phase 11) | Writes `studio.apply.log` (`STUDIO_ARTIFACTS.APPLY_LOG`) with `appliedAt`, `output`, `success` after every successful apply |

---

## Tools & Workflows Catalogue (Complete Picture)

### Tools: what exists vs what the artifact system anticipates

| Tool name | Artifact out | Implemented | CLI | HTTP |
|---|---|---|---|---|
| `studio-introspect` | `studio.schema.snapshot` | ✅ | ✅ | ✅ |
| `studio-sql-parse` | `studio.sql.ast` | ✅ | ✅ | ✅ |
| `studio-intent-sync` | `studio.intent.sync-report` | ✅ | (via adopt) | ✅ (`POST /api/studio/intent-sync`) |
| `studio-intent-init` | `studio.intent.graph` | ✅ | (via adopt) | ✅ (`POST /api/studio/intent-init`) |
| `studio-add-column` | migration file | ✅ | ✅ | ✅ |
| `studio-add-function` | migration file | ✅ | ✅ | ✅ |
| `studio-create-rpc` | migration file | ✅ | ✅ | ✅ |
| `studio-create-table` | migration file | ✅ | ✅ | ✅ |
| `studio-add-rls-policy` | migration file | ✅ | ✅ | ✅ |
| `studio-add-index` | migration file | ✅ | ✅ | ✅ |
| `studio-add-constraint` | migration file | ✅ | ✅ | ✅ |
| `studio-create-view` | migration file | ✅ | ✅ | ✅ |
| `studio-rls-check` | `studio.rls.plan` + `studio.rls.report` | ✅ | ✅ | ✅ |
| `studio-rpc-lint` | `studio.rpc.plan` | ✅ | ✅ | ✅ |
| `studio-migration-plan` | `studio.migration.plan` | ✅ | ✅ | ✅ |
| `studio-lint` | `studio.migration.lint` | ✅ | ✅ (`studio-migration-lint` alias) | ✅ |
| `studio-release-gate` | `studio.release.gate` | ✅ | ✅ | ✅ |
| `studio-greenfield-init` | `studio.intent.graph` (greenfield) | ✅ | ✅ | ✅ |
| `studio-intent-patch` | `studio.intent.graph` (mutated) | ✅ | ✅ | ✅ |
| `studio-endpoint-map` | `studio.intent.graph` (endpoints added) | ✅ | ✅ | ✅ |

### Workflows: what exists vs what's planned

| Workflow | Steps | Implemented |
|---|---|---|
| `adopt-backend` | introspect → sql-parse → intent-sync (review) → intent-init (approve) | ✅ |
| `greenfield-init` | init-graph (empty) → Schema Builder forms → generate-create-table × N | ✅ (tool + UI) |
| `create-table` | generate-create-table → migration-lint | ✅ (cataloged guided workflow) |
| `add-rls-policy` | generate-add-rls-policy → rls-check preview | ✅ (cataloged guided workflow) |
| `release-check` | rls-check → rpc-lint → migration-lint → release-gate | ✅ |

---

## Gap Analysis: How Far to 100%

```
Layer 1: Understand   ████████████████████ 100%  (endpoint mapping + UI mutation complete)
Layer 2: Design       ████████████████████ 100%  (table + RLS + function + RPC + view builders)
Layer 3: Generate     ████████████████████ 100%  (all 8 scaffold tools + greenfield-init)
Layer 4: Validate     ████████████████████ 100%  (5/5 validation tools, CLI + HTTP wired)
Layer 5: Apply        ████████████████████ 100%  (apply + gate enforcement + snapshot verify + audit log)

Overall platform:     100% for original core capability layers; catalog richness now expanding ✅
```

The infrastructure investment is high-quality and pays forward. Core capability layers are complete; current work is about catalog ergonomics, persona coverage, and guided workflow breadth.

---

## Roadmap to 100%

### Phase 6 — Missing Scaffold Tools (Layer 3 completion)

The most impactful next batch: filling in the generation tools that users actually need.

**Priority 1 — `generate-create-table`**

```ts
interface CreateTableInput {
  schema: string;
  name: string;
  columns: Array<{ name: string; type: string; nullable: boolean; default?: string; identity?: boolean }>;
  primaryKey?: string[];   // column names; defaults to first identity column
  enableRls: boolean;      // default: true (always yes for Supabase)
}
```

Generates:
```sql
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
```

Does **not** require an existing intent graph — this is the greenfield entry point. After writing the file, optionally writes a minimal `EntityNode` into the intent graph to avoid a round-trip `studio-adopt` for brand-new tables.

**Priority 2 — `generate-add-rls-policy`**

```ts
interface AddRlsPolicyInput {
  entityId: string;
  policy: {
    name: string;
    command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
    roles: string[];
    using?: string;       // USING expression
    withCheck?: string;   // WITH CHECK expression
    permissive?: boolean; // default true
  };
}
```

Generates:
```sql
CREATE POLICY "users_select_authenticated"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
```

**Priority 3 — `generate-add-index` and `generate-add-constraint`**

Simple generators for common schema additions:
```sql
-- index
CREATE INDEX users_email_idx ON public.users (email);

-- FK constraint
ALTER TABLE public.orders
  ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
```

---

### Phase 7 — Validation Chain (Layer 4)

Five tools that read the intent graph + DB snapshot and produce structured findings. No DB writes — pure analysis.

**`rls-check`** (highest value):
- Input: `studio.intent.graph`, `studio.schema.snapshot`
- Logic: for each managed entity with RLS enabled, verify SELECT/INSERT/UPDATE/DELETE coverage. Flag tables with no policies. Flag SECURITY DEFINER functions.
- Output: `studio.rls.plan` (what policies should exist) + `studio.rls.report` (gaps + warnings)
- This one tool immediately answers: "is my Supabase project secure?"

**`migration-lint`**:
- Input: `studio.sql.ast` (parsed migration files)
- Logic: reuses `riskMeta` already extracted by sql-parse. Adds: naming convention checks, lock-unsafe patterns, missing transaction wrappers around destructive ops.
- Output: `studio.migration.lint`

**`rpc-lint`**:
- Input: `studio.intent.graph` (FunctionNode list)
- Logic: check security model, search_path, exposed to PostgREST without auth guard.
- Output: `studio.rpc.plan`

**`migration-plan`**:
- Input: `studio.intent.graph` + `studio.schema.snapshot`
- Logic: diff intent graph against live DB. Classify each delta by `ChangeClass`. Order changes safely.
- Output: `studio.migration.plan`

**`release-gate`**:
- Input: `studio.rls.report`, `studio.rpc.plan`, `studio.migration.lint`
- Logic: aggregate all findings, produce single pass/fail.
- Output: `studio.release.gate`

---

### Phase 8 — Dashboard Schema Builder (Layer 2)

The visual builder is the layer users actually see. It calls the existing scaffold HTTP routes.

**Schema Builder panel** (new section in Adoption page or standalone route `/builder`):

```
┌─────────────────────────────────────────────────────────────────┐
│ New Table                                         [Cancel]       │
├─────────────────────────────────────────────────────────────────┤
│ Schema  [public ▼]   Name  [users___________]                   │
├─────────────────────────────────────────────────────────────────┤
│ Columns                                          [+ Add Column]  │
│ ┌────────────────┬──────────────────┬──────────┬──────────────┐ │
│ │ id             │ uuid             │ NOT NULL │ [Delete]     │ │
│ │ email          │ text             │ NOT NULL │ [Delete]     │ │
│ │ created_at     │ timestamptz      │ NULL     │ [Delete]     │ │
│ └────────────────┴──────────────────┴──────────┴──────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ [x] Enable RLS                                                  │
├─────────────────────────────────────────────────────────────────┤
│ Generated SQL ──────────────────────────────────────────────── │
│ CREATE TABLE public.users (                                     │
│   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),                │
│   email text NOT NULL,                                          │
│   created_at timestamptz DEFAULT now()                          │
│ );                                                              │
│ ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;             │
└──────────────────────────────────────────────────────[Generate]─┘
```

**RLS Policy Builder** (companion to entity builder):

```
┌─────────────────────────────────────────────────────────────────┐
│ Add Policy for: public.users              [Cancel]              │
├─────────────────────────────────────────────────────────────────┤
│ Name       [users_select_authenticated_____]                    │
│ Command    [SELECT ▼]     Roles  [authenticated ▼]             │
│ USING      [auth.uid() = id___________________]                 │
│ WITH CHECK [________________________] (optional)                │
├─────────────────────────────────────────────────────────────────┤
│ Generated SQL ──────────────────────────────────────────────── │
│ CREATE POLICY "users_select_authenticated"                      │
│   ON public.users FOR SELECT TO authenticated                   │
│   USING (auth.uid() = id);                                      │
└──────────────────────────────────────────────────────[Generate]─┘
```

"Generate" → calls `POST /api/studio/scaffold/create-table` → file written to disk → opens file in migration studio editor for final review → user clicks Apply.

---

### Phase 9 — Greenfield Workflow + Gate Enforcement (Layers 1+5) ✅ Complete

**Greenfield init (✅):**
- `sbt studio-greenfield-init` / `POST /api/studio/greenfield-init` — creates empty intent graph with `mode: 'greenfield'`
- Schema Builder page shows "Project Setup" panel: if no intent graph exists, offers "Initialize Greenfield Project" button
- After init, user designs tables via the Schema Builder forms and generates migrations
- "Release Gate" panel on Schema Builder page lets user run the gate before applying

**Gate enforcement at apply (✅):**
- `POST /api/apply` now reads `studio.release.gate` before proceeding
- If gate artifact exists and `status: 'fail'` → 422 response, lists blocking issues, apply blocked
- If no gate artifact → apply proceeds but response includes `gateWarning` field advising the user to run the gate
- Snapshot hash staleness check is still not implemented (Phase 10 scope)

---

### Phase 10 — Intent Graph Mutation & Endpoint Mapping ✅ Complete

**Intent graph mutation (✅):**
- `tools/intent-patch.ts` + `sbt studio-intent-patch` — patches a single entity's `managedStatus`; `exclude` action adds to `managedScope.explicitExclusions`; `set-status` removes from exclusions when promoting
- `POST /api/studio/intent-graph/entity` HTTP route
- Adoption page: color-coded status badges, per-row "Manage" and "Exclude" action buttons

**Endpoint mapping (✅):**
- `tools/endpoint-map.ts` + `sbt studio-endpoint-map` — derives `EndpointNode[]` in intent graph
- For each managed entity → `table-crud` endpoint with `allowedRoles` from associated policies
- For each managed public-schema function → `rpc` endpoint
- `POST /api/studio/endpoint-map` HTTP route
- Adoption page: "Map Endpoints" button shows total count and breakdown after run

---

### Phase 11 — Full Vision Complete ✅ Complete

**`generate-create-view` tool (✅):**
- `tools/generate-create-view.ts` + `sbt studio-create-view --schema public --name <name> --query "SELECT ..."` — no intent graph required
- `POST /api/studio/scaffold/create-view` HTTP route

**Apply improvements — Layer 5 completion (✅):**
- **Audit log:** after a successful `POST /api/apply`, writes `studio.apply.log` artifact (`appliedAt`, `output`, `success`) — always a record of the most recent apply
- **Snapshot staleness check:** if a `studio.migration.plan` artifact exists at apply time, recomputes the current snapshot hash and includes `snapshotStale: true` in the response when the snapshot has changed since the plan was generated — warns without blocking

**Schema Builder UI — Layer 2 completion (✅):**
- `FunctionBuilder` component — schema, name, params table (add/remove rows), return type, language (sql/plpgsql), security (invoker/definer), inline body textarea, live SQL preview; calls `POST /api/studio/scaffold/add-function`
- `RpcBuilder` component — same as FunctionBuilder but forces `schema: public`; calls `POST /api/studio/scaffold/create-rpc`
- `ViewBuilder` component — schema, name, SELECT query textarea, live SQL preview; calls `POST /api/studio/scaffold/create-view`
- All three builders appear in the Schema Builder page below the existing Table and Policy builders

**New artifact constant:**
- `STUDIO_ARTIFACTS.APPLY_LOG` — `studio.apply.log` artifact for apply audit records

---

## Completion Estimate by Phase

| Phase | Layer | What it unlocks | Rough effort |
|---|---|---|---|
| **6** — Scaffold tools | 3 | Create table + RLS policies from CLI/HTTP | Medium |
| **7** — Validation chain | 4 | Security analysis, lint, release gate | Medium-large |
| **8** — Dashboard builder | 2 | Visual low-code creation in browser | Large (UI-heavy) |
| **9** — Greenfield + gate | 1+5 | Start from scratch; safe apply | Medium |
| **10** — Mutation + endpoints | 1 | Manage classifications; API surface | Medium |

**At Phase 6 completion**: The platform is a usable CLI toolkit for brownfield adoption + basic scaffolding. Still no visual builder.

**At Phase 8 completion**: The dashboard can create tables, add columns, and write RLS policies through forms. This is the "low-code" milestone — the original vision becomes real for the most common operations.

**At Phase 10 completion**: Full vision. Greenfield and brownfield covered. Every Supabase backend object has a visual builder. The intent graph is the source of design truth, kept in sync with SQL migrations, gated before every apply.

---

## What Exists vs What Was Anticipated

The artifact system and SDK types were designed for the full vision from the start. Comparing what was anticipated (defined in `writers.ts` / `constants.ts` / `studio-types.ts`) against what's implemented:

| Anticipated artifact | Writer ✅ | Schema ✅ | Tool ❓ |
|---|---|---|---|
| `studio.schema.snapshot` | ✅ | ✅ | ✅ Implemented |
| `studio.sql.ast` | ✅ | ✅ | ✅ Implemented |
| `studio.intent.sync-report` | ✅ | ✅ | ✅ Implemented |
| `studio.intent.graph` | ✅ | ✅ | ✅ Implemented |
| `studio.workflow.run` | ✅ | ✅ | ✅ Implemented |
| `studio.rls.plan` | ✅ | ✅ | ✅ Implemented (Phase 7) |
| `studio.rls.report` | ✅ | ✅ | ✅ Implemented (Phase 7) |
| `studio.rpc.plan` | ✅ | ✅ | ✅ Implemented (Phase 7) |
| `studio.migration.plan` | ✅ | ✅ | ✅ Implemented (Phase 7) |
| `studio.migration.lint` | ✅ | ✅ | ✅ Implemented (Phase 7) |
| `studio.release.gate` | ✅ | ✅ | ✅ Implemented (Phase 7) |
| `studio.apply.log` | ✅ | ✅ | ✅ Implemented (Phase 11) |

All 12 artifact contracts are fully producing.

---

## Key Architectural Constraint

The platform now supports both strict and loose paths:

- strict (`managed`): intent-graph-backed, validation-gated
- loose (`assisted`/`loose`): selected generators can run without full adoption state

Remaining constraint to improve: parameterized scaffold workflows (`create-table`, `add-rls-policy`) are cataloged as guided flows, but still rely on explicit user/tool input rather than fully automatic engine execution.

---

## Persona-Oriented Expansion (Next)

To make this a backend-building platform accessible across backgrounds, extend catalogs by audience and control mode.

### Control Modes

- `managed`: strict intent ownership + gating
- `assisted`: recommendations + selective enforcement
- `loose`: minimal constraints, generate/analyze only

### Backend Dev Oriented Tools (Proposed)

1. `studio-contract-check` — detect breaking schema/API contract changes
2. `studio-perf-check` — index/query risk heuristics and lock-risk scoring
3. `studio-data-backfill-plan` — staged data backfill plan for non-null/default migrations
4. `studio-drift-check` — live DB vs intent/migration drift report
5. `studio-rollback-plan` — conservative rollback strategy artifact

### Business/Product Oriented Tools (Proposed)

1. `studio-impact-summary` — plain-English summary of changes, risk, blast radius
2. `studio-policy-plain-language` — translate RLS/policy intent to business language
3. `studio-feature-to-schema` — convert feature brief into suggested entities/endpoints
4. `studio-release-readiness-report` — non-technical go/no-go report
5. `studio-kpi-surface-map` — map schema/API changes to affected metrics and owners

### Backend Dev Oriented Workflows (Proposed)

1. `safe-release`: migration-plan → lint → rls-check → rpc-lint → release-gate → apply
2. `expand-contract`: additive-safe rollout before destructive follow-up
3. `brownfield-hardening`: adopt → intent-patch → endpoint-map → release-check

### Business/Product Oriented Workflows (Proposed)

1. `feature-intake`: brief → proposed schema/API package → review artifact
2. `change-approval`: impact-summary → risk thresholds → sign-off artifact
3. `release-brief`: release-check output → stakeholder summary → publish artifact
