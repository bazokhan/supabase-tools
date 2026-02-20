# Migration Studio Platform Plan (Atomic Tools -> Workflows -> Guided UI)

## 1. Product Goal

Transform Migration Studio from a SQL-first editor into a workflow-driven backend platform where users can create, update, and secure endpoints with minimal SQL expertise while preserving expert control.

Primary outcome:
- A user can ship protected, reliable Supabase/Postgres endpoints through guided flows.
- A user with an existing Postgres or Supabase backend can adopt the platform incrementally without rewriting anything.

Non-goals:
- Replacing SQL as executable truth.
- Hiding all complexity at the cost of unsafe abstraction.
- Requiring full adoption — partial management must be a first-class mode, not an afterthought.

## 2. Core Philosophy (Required)

1. Atomic tools with strict boundaries.
2. Artifact contracts between tools (versioned, typed, auditable).
3. Workflows as orchestration of tools (not monolithic logic).
4. UI invokes workflows and explains outcomes.
5. SQL remains canonical executable output.
6. Existing infrastructure is respected — never silently rewrite, drop, or reorder what the platform didn't create.
7. Use mature open-source libraries for hard problems (parsing, introspection); build only what is domain-specific to this platform.

## 3. Operating Modes (Critical for Flexibility)

The platform must support all three from day one of architecture:

1. Greenfield mode
- Build new entities/endpoints from intent.
- Full management from the start, no adoption step needed.

2. Brownfield managed mode
- Existing DB imported into intent graph with high confidence.
- Studio can safely update entities already in production.
- All managed entities have clear provenance linking back to the original SQL/migration that defined them.

3. Brownfield assisted mode
- Partial/low-confidence import.
- Studio manages only selected parts; unknown SQL remains opaque and preserved.
- Users can expand managed scope incrementally by reviewing and promoting opaque regions.

## 4. Architecture

### 4.1 Layered Model

1. Tool Layer
- CLI/plugin commands that do one thing well.
- No UI assumptions.
- Each tool maps to an existing or new plugin command.

2. Contract Layer
- Versioned artifacts and JSON schemas.
- Deterministic compatibility rules.
- Leverages existing `ArtifactEnvelope` infrastructure in `sdk/src/artifacts.ts`.

3. Workflow Layer
- Pipeline execution over artifacts (linear steps with conditional branches, not full DAG).
- Gate policies and rollback guidance.
- Human-decision checkpoints at defined points.

4. Studio API Layer
- Job orchestration, status, events, logs.
- HTTP contract served by `plugin-migration-studio`.
- SSE streams for real-time progress (extends existing `/api/events` pattern).

5. UI Layer
- Intent capture, guided decisions, gate visibility, explainability.
- Integrated into existing `ui-web` dashboard as new pages/sections.

### 4.2 SQL + Intent Dual Representation

The platform maintains two linked representations:
- SQL migrations/functions (execution truth),
- `studio.intent.graph` (design/control truth).

Required behavior:
- Intent -> SQL generation (deterministic, stable output).
- SQL -> intent extraction with confidence scoring per node.
- Drift report when they diverge (sync-report artifact).
- Opaque block preservation for unsupported SQL.
- Manual SQL edits to generated files are detected and either reconciled or marked as custom overrides.

### 4.3 Relationship to Existing Commands

The new tools build on existing infrastructure rather than replacing it:

| Existing | New Tool | Relationship |
|---|---|---|
| `snapshot` command + extractors | `studio-introspect` | Wraps snapshot output into a structured artifact. Reuses extractors for functions, views, triggers, policies, types, enums. |
| `migrate` command | `studio-migration-apply` | Workflow step that calls migrate with gate-check precondition. Migrate remains the actual executor. |
| `sql-analyzer` (sdk) | `studio-sql-parse` | Regex analyzer used for quick risk detection and classification. Real AST parsing via `@supabase/pg-parser` for structural extraction. Both coexist (see §4.4). |
| `migration.analysis` artifact (migration-audit plugin) | `studio-intent-sync` | Consumes migration-audit's analysis as one input for building the sync report. |
| `plugin-migration-studio` HTTP server | Studio API Layer | Existing routes (`/api/schema`, `/api/templates`, `/api/validate`, `/api/analyze`, `/api/save`, `/api/apply`) remain. New workflow routes are added alongside them. |

### 4.4 Two-Layer SQL Analysis Strategy

The platform uses two complementary SQL analysis approaches:

**Layer 1: Regex analyzer (existing `sdk/src/sql-analyzer.ts`)**
- Purpose: fast classification, risk detection, operation counting.
- Strength: zero dependencies, instant, good for UI indicators and lint rules.
- Limitation: no structural understanding — cannot extract column definitions, policy USING clauses, function bodies, or constraint details.
- Used by: `studio-migration-lint`, risk badges in UI, existing migration-audit plugin.

**Layer 2: Real Postgres parser (`@supabase/pg-parser` WASM)**
- Purpose: full AST extraction for intent graph construction.
- Strength: 100% Postgres-compatible (uses real PG C parser compiled to WASM), handles all valid Postgres syntax, multi-version support (PG 15/16/17).
- Limitation: WASM loading overhead (~3KB JS + lazy WASM binary), no deparsing built in.
- Used by: `studio-sql-parse`, brownfield adoption, any tool that needs structural understanding of SQL.

**Deparsing: `pgsql-deparser` (pure TypeScript)**
- Purpose: converting AST nodes back to SQL strings for generation.
- Strength: pure TypeScript, no WASM, works in any environment.
- Used by: `studio-sql-generate` for intent→SQL direction.

Why both layers: the regex analyzer already works, is fast, and is used by multiple consumers (migration-audit, migration-studio UI). It handles the "what kind of operation is this?" question well. The real parser handles the "what exactly does this operation do?" question. They serve different purposes and both remain useful.

## 5. External Dependencies and Library Choices

### 5.1 SQL Parsing

| Library | Role | Justification |
|---|---|---|
| [`@supabase/pg-parser`](https://github.com/supabase-community/pg-parser) | SQL → AST parsing | Supabase community maintained. Real PG C parser compiled to WASM. Multi-version (PG 15/16/17). Runs in Node and browser. Natural choice for a Supabase-focused tool. |
| [`pgsql-deparser`](https://www.npmjs.com/package/pgsql-deparser) | AST → SQL string | Pure TypeScript, zero native deps. Converts libpg_query AST nodes back to SQL. Pairs with `@supabase/pg-parser` for round-trip capability. |

**Evaluated and rejected:**
- `pgsql-ast-parser` (oguimbal) — pure JS, but incomplete Postgres coverage (built for pg-mem, not production DDL). Cannot handle all RLS policy syntax or advanced function bodies.
- `node-sql-parser` — multi-dialect, Postgres support is secondary. Misses Postgres-specific constructs (RLS, extensions, security invoker).

### 5.2 Schema Introspection

| Library | Role | Justification |
|---|---|---|
| Existing snapshot extractors | Primary introspection | Already extract functions, views, triggers, policies, types, enums from `pg_catalog`. Supabase-aware schema filtering. Proven in production. |
| [`extract-pg-schema`](https://github.com/kristiandupont/extract-pg-schema) | Column/constraint detail | Our extractors focus on object-level SQL; they don't extract column definitions, constraint details, or FK relationships. `extract-pg-schema` fills this gap for table structure introspection. Evaluate for use within `studio-introspect`. |

**Why not replace extractors entirely with extract-pg-schema:** our extractors produce `.sql` files per object (used by snapshot, dashboard, docs). `extract-pg-schema` returns JSON metadata. Both are useful — extractors for the existing snapshot workflow, `extract-pg-schema` for structured metadata in the intent graph.

### 5.3 Schema Diffing

**Industry landscape:** the best Postgres schema diff tools (Stripe's [`pg-schema-diff`](https://github.com/stripe/pg-schema-diff), Xata's [`pgroll`](https://github.com/xataio/pgroll), Ariga's [Atlas](https://atlasgo.io/)) are all Go binaries. There is no mature JavaScript/TypeScript library for Postgres schema diffing.

**Our approach:** build our own diff logic, operating on intent graphs (not raw SQL or live DB comparison). This is simpler and more aligned with the architecture:
- Diff is between two `studio.intent.graph` versions (before vs. after user edit).
- Intent graph nodes are structured TypeScript objects — diffing is straightforward.
- We don't need to diff arbitrary SQL or compare two live databases.

**Pattern adopted from pgroll:** the [expand/contract pattern](https://xata.io/blog/pgroll-expand-contract) for non-additive changes. When a change cannot be applied atomically (rename, type narrowing, destructive changes), `studio-migration-assemble` generates a multi-step migration:
1. **Expand**: add new column/object alongside the old one.
2. **Backfill**: copy/transform data from old to new.
3. **Switchover**: update constraints, policies, functions to reference the new object.
4. **Contract**: drop the old object (in a separate migration or after confirmation).

This is safer than single-step ALTER for production databases and aligns with how pgroll, Stripe, and other teams handle zero-downtime migrations.

### 5.4 Workflow Engine

**No external library.** The workflows in scope are 5–12 sequential steps with 2–3 human checkpoints. This does not justify a state machine framework.

**Evaluated and rejected:**
- `XState v5` — excellent actor-model library, but designed for statecharts with parallel states, guarded transitions, and complex event hierarchies. Our workflows are linear pipelines. XState would add ~40KB of dependency for a problem solvable in ~100 lines of TypeScript.
- `BullMQ` — Redis-backed job queue. Our workflows are single-user, local, and file-based. No need for distributed job infrastructure.

**What we build:** a minimal pipeline runner (~100–150 lines) that:
- Iterates through step definitions.
- Calls each tool, captures the artifact output.
- Pauses at checkpoint steps and persists state to disk.
- Resumes from any step.
- Stores run state as a `studio.workflow.run` artifact.

This is the same complexity level as a test runner or a build script — well within the scope of custom code that doesn't warrant a framework.

### 5.5 RLS Policy Modeling

**Pattern reference:** [Drizzle ORM's RLS support](https://orm.drizzle.team/docs/rls) provides declarative policy definitions in TypeScript with template helpers for Supabase/Neon roles. Our `PolicyNode` in the intent graph serves a similar purpose — declarative policy intent that generates SQL.

We don't use Drizzle as a dependency, but its API design is a good reference for:
- Template-based policy definitions (owner-only, role-based, org-scoped).
- Mapping Supabase auth helpers (`auth.uid()`, `auth.jwt()`) into policy expressions.
- Combining templates with custom USING/WITH CHECK expressions.

### 5.6 Dependency Summary

| Package | Purpose | Type | Size Impact |
|---|---|---|---|
| `@supabase/pg-parser` | SQL parsing | new prod dep | ~3KB JS + lazy WASM |
| `pgsql-deparser` | AST → SQL | new prod dep | ~50KB (pure TS) |
| `extract-pg-schema` | Column/constraint introspection | evaluate | ~30KB (pure JS) |

Total new dependency footprint: minimal. No native binaries, no heavy frameworks, no runtime services.

## 6. Atomic Tool System

### 6.1 Tool Contract Rules

Every tool must declare:
- stable command name,
- artifact inputs (by ID + version constraint),
- artifact outputs (by ID + version),
- idempotency behavior (idempotent / append-only / destructive),
- deterministic error schema (typed error codes, not free-form strings),
- safety classification (read-only / write-plan / write-apply).

Tool outputs use the existing `ArtifactEnvelope` shape:
- `id`, `version`, `producer`, `generatedAt`, `inputs`, `data`, `diagnostics`.

### 6.2 Proposed Tool Catalog

Tools are grouped by function. Each entry shows what it consumes, what it produces, what existing code it builds on, and which parsing layer it uses.

#### Discovery and Normalization

1. `studio-introspect`
- Consumes: live DB connection
- Produces: `studio.schema.snapshot@1.0.0`
- Builds on: existing `snapshot` extractors + `extract-pg-schema` for column/constraint detail
- Parsing: none (direct SQL queries against `pg_catalog` / `information_schema`)
- Reads live schema, policies, grants, extensions, column definitions, constraints, indexes, FKs. Outputs a structured snapshot artifact with full structural detail.

2. `studio-sql-parse`
- Consumes: migration files (`.sql` from migrations directory)
- Produces: `studio.sql.ast@1.0.0`
- Builds on: `@supabase/pg-parser` (WASM) for full AST, existing `sql-analyzer` for risk metadata
- Parsing: **real parser (Layer 2)**. Every statement goes through `@supabase/pg-parser`. Statements that parse successfully produce typed AST nodes. Statements that fail parsing (extremely rare with the real PG parser, but possible with dynamic SQL or `COPY` data blocks) become opaque blocks.
- Risk metadata (destructive ops, transaction wrapping) is extracted by the regex analyzer in parallel for fast classification.

3. `studio-intent-sync`
- Consumes: `studio.schema.snapshot`, `studio.sql.ast`, `studio.intent.graph` (if exists)
- Produces: `studio.intent.sync-report@1.0.0`
- Parsing: none (operates on structured artifacts)
- Compares DB reality + parsed SQL against the current intent graph.
- Outputs: matched nodes, unmatched DB objects, unmatched intent nodes, confidence per match, drift details.

#### Modeling and Generation

4. `studio-intent-init`
- Consumes: `studio.intent.sync-report` (brownfield) or user intent input (greenfield)
- Produces: `studio.intent.graph@1.0.0`
- Greenfield: creates intent graph from user-provided entity/policy/endpoint definitions.
- Brownfield: creates intent graph from sync report, marking high-confidence nodes as managed and low-confidence nodes as opaque.

5. `studio-sql-generate`
- Consumes: `studio.intent.graph`
- Produces: `studio.sql.bundle@1.0.0`
- Builds on: `pgsql-deparser` for AST→SQL conversion of managed nodes
- Generates SQL from intent graph. Only touches managed nodes. Opaque nodes are passed through verbatim.
- Output includes stable ID comments for traceability (`-- @studio:entity:users:column:email`).

6. `studio-migration-assemble`
- Consumes: `studio.sql.bundle`, `studio.schema.snapshot` (current state), previous `studio.intent.graph` (if updating)
- Produces: `studio.migration.plan@1.0.0` + `.sql` migration file(s)
- Diffs current state against desired state. Classifies each change (see §7.4). Generates ordered migration SQL.
- Uses the expand/contract pattern (inspired by pgroll) for non-additive changes.

#### Security and Policy Design

7. `studio-rls-plan`
- Consumes: `studio.intent.graph` (entity + policy intent)
- Produces: `studio.rls.plan@1.0.0`
- Generates RLS policy SQL from intent matrix. Templates encode Supabase role assumptions (anon, authenticated, service_role).
- Template library inspired by Drizzle ORM's declarative RLS patterns: owner-only, role-based, org-scoped, public-read, and custom USING/WITH CHECK expressions.

8. `studio-rls-verify`
- Consumes: `studio.rls.plan`, `studio.schema.snapshot`
- Produces: `studio.rls.report@1.0.0`
- Checks: every exposed table has policies, no gaps between SELECT/INSERT/UPDATE/DELETE, security definer functions flagged for extra review, policy consistency across related tables.

9. `studio-function-guard`
- Consumes: `studio.intent.graph` (function specs)
- Produces: `studio.rpc.plan@1.0.0`
- Generates function wrappers with: input validation, authz checks, search_path pinning, security invoker preference (flags definer with lint warning).

#### Validation and Release Gates

10. `studio-migration-lint`
- Consumes: `studio.migration.plan`
- Produces: `studio.migration.lint@1.0.0`
- Builds on: existing `sql-analyzer` (regex, Layer 1) for fast risk detection
- Checks: destructive operations flagged, transaction wrapping, IF EXISTS usage, naming conventions, backwards-compatible column additions, lock-safe patterns (inspired by Stripe's `pg-schema-diff` hazard system).

11. `studio-release-check`
- Consumes: `studio.migration.lint`, `studio.rls.report`, `studio.rpc.plan` (if applicable), `studio.schema.snapshot`
- Produces: `studio.release.gate@1.0.0`
- Aggregates all validation results into pass/fail with blocking reasons, warnings, and required acknowledgements.
- Runs dry-run/EXPLAIN against DB when connection is available.

### 6.3 Artifact Dependency Graph

```
DB connection ─────────────────────┐
                                   ▼
Migration files (.sql) ──► studio-sql-parse ──► studio.sql.ast
                           (@supabase/pg-parser   │
                            + sql-analyzer)        │
                                                   ▼
              studio-introspect ──► studio.schema.snapshot
              (extractors +            │
               extract-pg-schema)      │
                    ┌──────────────────┤
                    ▼                  ▼
              studio-intent-sync ──► studio.intent.sync-report
                    │
                    ▼
              studio-intent-init ──► studio.intent.graph
                    │
         ┌─────────┼──────────┐
         ▼         ▼          ▼
  studio-rls-plan  │  studio-function-guard
         │         │          │
         ▼         ▼          ▼
  studio.rls.plan  │  studio.rpc.plan
         │         │          │
         ▼         ▼          ▼
  studio-rls-verify│  studio-sql-generate ──► studio.sql.bundle
         │         │  (pgsql-deparser)        │
         ▼         │                          ▼
  studio.rls.report│  studio-migration-assemble ──► studio.migration.plan
                   │  (expand/contract pattern)     │
                   ▼                                ▼
            studio-migration-lint ──► studio.migration.lint
            (sql-analyzer regex)            │
                                            ▼
                   studio-release-check ──► studio.release.gate
                              │
                              ▼
                      migrate (apply)
```

## 7. Workflow Architecture

### 7.1 Workflow Execution Model

Workflows are defined as TypeScript objects (not JSON/YAML — keeps them type-checked and colocated with tools). Each workflow is a linear pipeline of steps with conditional branches at decision points.

```ts
interface WorkflowStep {
  id: string;
  tool: string;                          // tool command name
  inputArtifacts: ArtifactRef[];         // required inputs (id + version constraint)
  outputArtifact: ArtifactRef;           // what this step produces
  gate?: GatePolicy;                     // pass/warn/fail conditions on output
  checkpoint?: 'review' | 'approve';     // human decision required before next step
  skipWhen?: (ctx: WorkflowContext) => boolean;  // conditional skip
}

interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'running' | 'waiting_checkpoint' | 'failed' | 'completed';
  currentStep: number;
  steps: StepResult[];                   // completed step outputs
  createdAt: string;
  updatedAt: string;
}
```

**Why not a full DAG or state machine framework:** the workflows in scope are inherently sequential (introspect → parse → sync → plan → generate → lint → gate → apply). Conditional branches at decision points (e.g., "does this entity exist?") handle the non-linear cases. A full DAG runtime or XState adds complexity without clear benefit for these use cases. The pipeline runner is ~100–150 lines of TypeScript (see §5.4). If parallel tool execution becomes needed later, the step model can be extended with `parallel: StepGroup[]` without redesigning the runtime.

### 7.2 Workflow State Machine

```
            ┌─────────┐
            │ created  │
            └────┬─────┘
                 │ start
                 ▼
            ┌─────────────┐
     ┌──────│  running     │◄─────────┐
     │      └──────┬───────┘          │
     │             │                  │ resume (after
     │             │ step completes   │ checkpoint approved)
     │             ▼                  │
     │      ┌──────────────────┐      │
     │      │ waiting_checkpoint│──────┘
     │      └──────────────────┘
     │             │
     │             │ rejected / timeout
     │             ▼
     │      ┌─────────┐
     ├─────►│ failed   │
     │      └─────────┘
     │
     │ all steps complete
     ▼
┌───────────┐
│ completed  │
└───────────┘
```

Failed runs retain all artifacts produced before failure. Runs can be retried from the failed step (not from scratch) if the cause was transient. If the cause was a changed precondition (schema drift), the workflow must restart from the sync step.

### 7.3 Must-Have Workflows

1. **Create protected CRUD endpoint (greenfield)**
- Steps: intent-init → rls-plan → rls-verify → function-guard (if RPC) → sql-generate → migration-assemble → migration-lint → release-check
- Checkpoints: after rls-plan (review policies), after release-check (approve deploy)

2. **Add secure function endpoint**
- Steps: intent-init (function node) → function-guard → rls-plan (if table access) → sql-generate → migration-assemble → migration-lint → release-check
- Checkpoints: after function-guard (review security posture), after release-check

3. **Update existing entity safely**
- Steps: introspect → sql-parse → intent-sync → modify intent graph (user interaction) → sql-generate → migration-assemble (with change classification) → migration-lint → release-check
- Checkpoints: after intent-sync (review what's managed vs opaque), after migration-assemble (review change plan), after release-check
- This workflow is detailed further in §7.4.

4. **Adopt existing backend (brownfield)**
- Steps: introspect → sql-parse → intent-sync → intent-init (from sync report) → produce adoption report
- Checkpoints: after intent-sync (review confidence scores), after intent-init (confirm managed scope)
- No migration is generated — this workflow only establishes the intent graph. Updates come from workflow #3.

### 7.4 Update/Mutation Patterns (Detailed)

When modifying an existing entity, `studio-migration-assemble` must classify each change and generate appropriate SQL.

#### Change Classification

| Class | Example | SQL Strategy | Rollback |
|---|---|---|---|
| **Additive safe** | Add nullable column, add index | Single ALTER/CREATE statement | DROP column / DROP INDEX |
| **Additive with default** | Add NOT NULL column with default | ALTER ADD COLUMN ... DEFAULT; backfill if table is large | DROP column |
| **Rename (expand/contract)** | Rename column or table | Expand: add new column. Backfill: copy data. Switch: update constraints/policies/functions. Contract: drop old. | Reverse the expand/contract steps |
| **Type change (widening)** | varchar(50) → varchar(255), int → bigint | ALTER COLUMN TYPE (safe cast) | ALTER back (may truncate — warn) |
| **Type change (narrowing)** | varchar(255) → varchar(50) | Expand/contract: add new column with target type, backfill with validation, switch, drop old. Flag as destructive if data would be lost. | Reverse expand/contract |
| **Drop** | Remove column, drop table | Staged: remove from policies/functions first, then drop. Require explicit confirmation. | No automatic rollback — require backup acknowledgement |
| **Policy change** | Modify RLS policy | DROP + CREATE POLICY in transaction. Verify no gap in coverage. | Restore previous policy definition |
| **Constraint change** | Add/modify UNIQUE, CHECK, FK | Validate existing data satisfies constraint before applying. Use NOT VALID + VALIDATE CONSTRAINT for large tables. | DROP CONSTRAINT |

The expand/contract pattern (see §5.3) is used for rename and type-narrowing changes. This follows the same approach as pgroll and Stripe's pg-schema-diff, which treat renames as "add new + migrate data + drop old" rather than single ALTER statements that require exclusive locks.

#### Change Detection

Change detection works by diffing two intent graph versions:
1. Load the previous `studio.intent.graph` artifact (the "before" state).
2. Load the modified intent graph (the "after" state, produced by user edits in the UI or CLI).
3. Diff entity-by-entity, column-by-column, policy-by-policy.
4. Classify each diff into the change classes above.
5. Order changes by dependency (e.g., drop FK before drop column, add column before add FK).

Since both intent graphs are structured TypeScript objects, diffing is straightforward — no SQL parsing or live DB comparison needed at this stage.

#### Concurrent Edit Safety

When the user is reviewing a migration plan, the underlying DB may have changed (another developer applied a migration, or the user ran raw SQL). Before apply:
1. Re-run `studio-introspect` to get fresh snapshot.
2. Compare against the snapshot that was used to generate the plan.
3. If drift is detected, invalidate the plan and require re-generation from the sync step.
4. The release gate artifact carries a `snapshotHash` — apply refuses if the hash doesn't match current state.

## 8. Brownfield Adoption Model (Postgres + Supabase)

### 8.1 Adoption Pipeline

1. Introspect live schema, policies, grants, and extensions.
2. Parse migration history and current SQL assets using `@supabase/pg-parser` (full AST).
3. Build confidence-scored intent graph.
4. Mark unparseable or complex SQL as opaque.
5. Produce adoption report:
- what is fully managed (high confidence, understood SQL),
- partially managed (medium confidence, some opaque blocks),
- unmanaged (low confidence or user-excluded).

### 8.2 Confidence Scoring

Confidence is per-node (entity, column, policy, function, view, trigger) and determines managed scope:

| Confidence | Meaning | What Studio Does |
|---|---|---|
| **High (0.8-1.0)** | SQL fully parsed by `@supabase/pg-parser`, all references resolved, matches known patterns | Fully managed. Can generate, update, lint. |
| **Medium (0.5-0.8)** | SQL parsed but some constructs are non-standard, dependencies unclear, or cross-schema references unresolved | Managed with warnings. User must review before updates. |
| **Low (0.0-0.5)** | Dynamic SQL, complex cross-schema logic, or semantic constructs the intent graph cannot represent | Opaque. Preserved verbatim. Not touched by generation. |

With `@supabase/pg-parser` (real PG parser), parseability itself is rarely the issue — almost all valid Postgres SQL will parse. Confidence shifts to **semantic understanding**: can the intent graph represent this construct? Can we safely regenerate it?

Confidence factors:
- Semantic representability (does the intent graph have a node type for this?),
- Reference resolution (are all table/column/type references resolved?),
- Pattern recognition (does it match a known Supabase/Postgres idiom?),
- Migration history consistency (does the migration chain produce the current state?),
- Dependency complexity (how many cross-references does this object have?).

### 8.3 Managed Scope Rules

- Studio must never rewrite unmanaged regions automatically.
- Managed scope boundaries are explicit and versioned in the intent graph.
- Each node carries a `managedStatus: 'managed' | 'assisted' | 'opaque' | 'excluded'`.
- Users can promote opaque → assisted → managed by reviewing and confirming.
- Users can exclude nodes entirely (`excluded`) — studio ignores them even if parseable.

### 8.4 Supabase-Specific Handling

#### System Schemas
- `auth`, `storage`, `realtime`, `supabase_functions`, `extensions` schemas are **excluded by default**.
- Studio never generates migrations that touch system schemas.
- Objects in these schemas appear in the snapshot for reference (e.g., `auth.users` FK targets) but are read-only in the intent graph.

#### Extensions
- `CREATE EXTENSION` statements are detected and recorded in the intent graph as infrastructure nodes.
- Studio does not manage extension lifecycle but tracks which extensions are present (affects type availability, function availability).
- Extension-provided types (e.g., `uuid`, `jsonb`, PostGIS types, `pgvector` types) are recognized in column type analysis.

#### Supabase Roles and PostgREST
- RLS templates encode the standard role model: `anon`, `authenticated`, `service_role`.
- Policy generation uses `auth.uid()`, `auth.jwt()`, `auth.role()` helpers when targeting Supabase.
- Endpoint contracts note whether a table/function is exposed via PostgREST and under which role.
- `security definer` functions trigger additional lint (search_path pinning, input validation).

#### Existing RLS Policies That Don't Fit Templates
- Policies that use complex subqueries, cross-table joins, or custom functions are parsed (AST is available from `@supabase/pg-parser`) but classified as opaque policy nodes because the intent graph cannot guarantee safe regeneration.
- The intent graph records the raw USING/WITH CHECK expressions from the AST.
- Studio can verify these policies exist (coverage check) but doesn't attempt to regenerate them.
- Users can manually promote an opaque policy to managed by mapping it to a template + custom expression.

### 8.5 Adoption of Existing Migration History

When a project already has migration files:
1. Parse all existing `.sql` migrations with `studio-sql-parse` (using `@supabase/pg-parser` for full AST).
2. Cross-reference with the applied migrations in `schema_migrations` table.
3. Build a timeline: which migration introduced/modified each entity.
4. Intent graph nodes carry `origin: { migration: 'NNNN_name.sql', line: N }` for traceability.
5. Migrations that predate studio adoption are never modified. New studio-generated migrations are appended to the existing sequence.

## 9. Bidirectional Translation Design

### 9.1 Intent Graph Schema

The intent graph is the central data structure. Concrete shape:

```ts
interface IntentGraph {
  version: '1.0.0';
  mode: 'greenfield' | 'brownfield-managed' | 'brownfield-assisted';
  entities: EntityNode[];
  views: ViewNode[];
  functions: FunctionNode[];
  triggers: TriggerNode[];
  policies: PolicyNode[];
  endpoints: EndpointNode[];
  infrastructure: InfraNode[];      // extensions, schemas, custom roles
  opaqueBlocks: OpaqueBlock[];      // unparsed/unrepresentable SQL preserved verbatim
  managedScope: ManagedScope;       // explicit boundary declaration
}

interface EntityNode {
  id: string;                        // stable ID (e.g., 'public.users')
  schema: string;
  name: string;
  managedStatus: ManagedStatus;
  confidence: number;                // 0.0 - 1.0
  columns: ColumnNode[];
  constraints: ConstraintNode[];
  indexes: IndexNode[];
  origin?: SourceOrigin;             // migration file + line that created this
  customSqlBlocks?: string[];        // user-authored SQL blocks to preserve
}

interface ColumnNode {
  name: string;
  type: string;                      // Postgres type name (resolved, e.g., 'uuid' not 'extensions.uuid')
  nullable: boolean;
  default?: string;                  // raw SQL expression
  identity?: 'always' | 'by-default';
  generated?: string;                // GENERATED ALWAYS AS expression
  managedStatus: ManagedStatus;
  confidence: number;
}

interface ConstraintNode {
  name: string;
  type: 'primary_key' | 'unique' | 'check' | 'foreign_key' | 'exclusion';
  columns: string[];
  definition: string;               // raw SQL constraint definition
  references?: {                     // FK details
    schema: string;
    table: string;
    columns: string[];
    onDelete?: string;
    onUpdate?: string;
  };
}

interface IndexNode {
  name: string;
  columns: string[];
  unique: boolean;
  method: 'btree' | 'hash' | 'gin' | 'gist' | 'brin';
  where?: string;                    // partial index predicate
  definition: string;                // full CREATE INDEX expression
}

interface ViewNode {
  id: string;                        // e.g., 'public.active_users'
  schema: string;
  name: string;
  materialized: boolean;
  query: string;                     // the SELECT statement defining the view
  columns: { name: string; type: string }[];
  managedStatus: ManagedStatus;
  confidence: number;
}

interface TriggerNode {
  id: string;                        // e.g., 'trigger:public.users.audit_trigger'
  entity: string;                    // entity ID the trigger fires on
  name: string;
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
  events: ('INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE')[];
  forEach: 'ROW' | 'STATEMENT';
  function: string;                  // function ID that executes
  condition?: string;                // WHEN clause
  managedStatus: ManagedStatus;
  confidence: number;
}

interface PolicyNode {
  id: string;
  entity: string;                    // entity ID this policy applies to
  name: string;
  command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  roles: string[];
  using?: string;                    // raw SQL or template reference
  withCheck?: string;
  permissive: boolean;               // PERMISSIVE (default) or RESTRICTIVE
  template?: string;                 // e.g., 'owner-only', 'role-based', 'org-scoped'
  templateParams?: Record<string, string>;
  managedStatus: ManagedStatus;
  confidence: number;
}

interface FunctionNode {
  id: string;                        // e.g., 'public.get_user_profile(uuid)'
  schema: string;
  name: string;
  args: ArgSpec[];
  returnType: string;
  language: 'sql' | 'plpgsql' | 'plv8';
  security: 'invoker' | 'definer';
  volatility: 'volatile' | 'stable' | 'immutable';
  searchPath?: string[];             // SET search_path
  body?: string;                     // full function body (managed) or null (opaque)
  managedStatus: ManagedStatus;
  confidence: number;
}

interface ArgSpec {
  name?: string;
  type: string;
  mode: 'in' | 'out' | 'inout' | 'variadic';
  default?: string;
}

interface EndpointNode {
  id: string;
  type: 'table-crud' | 'rpc' | 'view';
  entity: string;                    // entity, function, or view ID
  exposedVia: 'postgrest' | 'rpc';
  allowedRoles: string[];
  operations: ('read' | 'create' | 'update' | 'delete')[];
}

interface InfraNode {
  id: string;
  type: 'extension' | 'schema' | 'role';
  name: string;
  details: Record<string, string>;   // extension: { version }, schema: { owner }, role: { login, superuser }
  managedStatus: ManagedStatus;
}

interface OpaqueBlock {
  id: string;
  rawSql: string;
  sourceSpan: { file: string; startLine: number; endLine: number };
  touchedObjects: string[];          // best-effort list from AST analysis
  reason: string;                    // why it's opaque: 'unrepresentable' | 'user-excluded' | 'too-complex'
  astAvailable: boolean;             // true if @supabase/pg-parser parsed it (just can't model it semantically)
}

type ManagedStatus = 'managed' | 'assisted' | 'opaque' | 'excluded';

interface ManagedScope {
  schemas: Record<string, 'managed' | 'read-only' | 'excluded'>;
  explicitExclusions: string[];      // object IDs explicitly excluded by user
}

interface SourceOrigin {
  migration: string;                 // filename
  line: number;                      // start line in migration file
  astNodeType?: string;              // libpg_query node type that produced this
}
```

Key additions over previous revision:
- **ViewNode** — views are structurally different from tables (read-only, defined by query, may be materialized). Snapshot extractors already extract them separately.
- **TriggerNode** — triggers are extracted by snapshot and affect entity behavior. Must be in the intent graph so that change classification can account for trigger dependencies.
- **ConstraintNode and IndexNode** — detailed structure (previously referenced but not defined). Needed for change detection and migration assembly.
- **InfraNode** — extensions, schemas, and roles are infrastructure that affects what's possible but aren't managed entities.
- **`astAvailable` on OpaqueBlock** — distinguishes "parser couldn't handle it" (rare with `@supabase/pg-parser`) from "parser handled it but intent graph can't represent it" (the common case). This matters for future coverage expansion.
- **`permissive` on PolicyNode** — Postgres supports both PERMISSIVE and RESTRICTIVE policies; the distinction is critical for security correctness.
- **`searchPath` on FunctionNode** — security-critical metadata. Functions without explicit search_path are flagged by `studio-function-guard`.

### 9.2 SQL -> Intent

The extraction pipeline leverages `@supabase/pg-parser` for full AST:

1. Parse each migration file through `@supabase/pg-parser`. This produces a complete Postgres AST for every statement.
2. Walk the AST. For each node type:
   - `CreateStmt` → EntityNode + ColumnNode[]
   - `AlterTableStmt` → modifications to existing EntityNode
   - `CreatePolicyStmt` → PolicyNode
   - `CreateFunctionStmt` → FunctionNode
   - `IndexStmt` → IndexNode
   - `ViewStmt` → ViewNode
   - `CreateTrigStmt` → TriggerNode
   - `CreateExtensionStmt` → InfraNode
   - `GrantStmt` / `RevokeStmt` → updates to EndpointNode or role metadata
   - Anything else → OpaqueBlock (with AST available for future expansion)
3. Score confidence based on: semantic representability, reference resolution, pattern match.
4. Cross-reference with live DB snapshot to validate extracted intent matches reality.

Required outputs per node:
- extracted intent node (typed),
- confidence score (0.0 - 1.0),
- source span reference (file, line range from AST position data),
- list of unresolved references (if any),
- diff from live DB state (if applicable).

### 9.3 Intent -> SQL

Generation uses `pgsql-deparser` for AST→SQL conversion where possible, with template-based generation for higher-level constructs:

- deterministic naming (e.g., policy names: `{table}_{command}_{role}_policy`),
- stable ID comments in SQL for traceability (`-- @studio:{node_type}:{node_id}`),
- idempotent patterns where valid (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`),
- preservation hooks for user-authored custom SQL blocks (identified by `-- @studio:custom:begin` / `-- @studio:custom:end` markers),
- generation order follows dependency graph (extensions → schemas → types → tables → indexes → functions → views → triggers → policies → grants),
- transaction wrapping is added by `studio-migration-assemble`, not by `studio-sql-generate`.

### 9.4 Handling Generation Conflicts

When re-generating SQL for a managed entity that has been manually edited:
1. Detect manual edits by comparing the last generated SQL (stored in artifact) against the current file.
2. If edits are within a `@studio:custom` block — preserve them.
3. If edits are outside custom blocks — present a diff to the user and ask: adopt manual edits into intent graph, or overwrite with generated version?
4. Never silently discard manual edits.

## 10. Safety, Security, and Reliability

### 10.1 Release Gate Contract

`studio.release.gate` shape:

```ts
interface ReleaseGate {
  status: 'pass' | 'fail';
  blocking: GateReason[];            // must resolve before apply
  warnings: GateReason[];            // should resolve, can acknowledge
  acknowledgements: Acknowledgement[]; // user must explicitly accept
  evidence: ArtifactRef[];           // links to lint, rls-report, etc.
  snapshotHash: string;              // hash of schema snapshot at plan time
  generatedAt: string;
}

interface GateReason {
  code: string;                      // e.g., 'DESTRUCTIVE_DROP', 'RLS_GAP', 'NO_TRANSACTION'
  severity: 'error' | 'warning';
  message: string;
  artifact: ArtifactRef;             // which artifact produced this finding
  remediation?: string;              // what to do about it
}
```

### 10.2 Gate Inputs

Minimum checks before apply:
- migration lint (destructive ops, lock safety, naming — via `sql-analyzer` regex layer),
- RLS coverage/consistency (every exposed table has policies for all operations),
- function guard checks (security definer flagged, search_path pinned),
- schema compatibility (no breaking changes to columns used by existing policies/functions),
- dry-run/EXPLAIN when DB is reachable (catches runtime errors before real apply),
- snapshot hash match (DB hasn't changed since plan was generated).

### 10.3 Security Baselines

- deny-by-default posture: new tables get `ENABLE ROW LEVEL SECURITY` with no policies (blocks all access until policies are added),
- explicit policy coverage for protected entities,
- elevated privilege use (security definer) requires: search_path pinning, input validation, stricter lint,
- endpoint contracts carry authz metadata tied to policy evidence,
- generated SQL never includes `GRANT ... TO public` without explicit user confirmation.

### 10.4 Error Recovery

When a workflow fails:
1. All artifacts produced by completed steps are retained.
2. The failing step's partial output (if any) is stored with `status: 'failed'` and the error.
3. The workflow run transitions to `failed` state with the failed step index.
4. User can fix the issue and resume from the failed step.
5. If the failure indicates schema drift (e.g., DB changed), the workflow must restart from the introspect/sync step — resuming from a later step with stale data is not allowed.
6. Failed workflow runs are never automatically cleaned up — they serve as audit trail.

## 11. UI and Interaction Architecture

### 11.1 Integration with Existing Dashboard

The UI is built as new pages within the existing `ui-web` dashboard, not as a standalone app. It follows the existing patterns:
- React SPA served from core's dashboard command on `:3400`.
- Data fetched from Studio API routes on the migration-studio server (`:3335` default).
- Real-time updates via SSE (extends existing `/api/events` pattern).
- Dark mode support via existing dashboard theme system.

### 11.2 Primary Surfaces

1. **Workbench** (new dashboard page)
- Active and recent workflow runs with step-by-step progress.
- Step status, artifacts produced, gate results.
- Resume/retry controls for failed/waiting workflows.

2. **Entity Modeler** (new dashboard page)
- Visual editor for intent graph entities: add/edit columns, constraints, indexes.
- Side-by-side preview of generated SQL (via `pgsql-deparser`).
- Diff view when modifying existing entities.

3. **Security Panel** (section within entity modeler or standalone)
- Policy matrix: table × operation × role grid.
- Template picker with preview of generated USING/WITH CHECK clauses.
- Coverage indicator (which operations are unprotected).

4. **Deploy Gate** (final step in workflow UI)
- Migration plan with change classification labels (additive, expand/contract, destructive).
- Risk profile (destructive changes highlighted, lock implications noted).
- Gate pass/fail with blocking reasons and remediation hints.
- Approve / reject / edit-and-retry actions.

5. **Adoption Report** (brownfield workflow result)
- Confidence map of discovered entities.
- Managed/opaque/excluded status per object.
- Promote/exclude controls for opaque nodes.
- AST availability indicator (shows what the parser understood even if the intent graph can't model it yet).

### 11.3 Explainability

Every generated artifact should be inspectable:
- source workflow step that produced it,
- tool that ran and its inputs,
- SQL output preview with intent-graph annotations,
- how to override (edit SQL directly, mark as custom, exclude from management).

### 11.4 Expert Escape Hatches

- Open generated SQL in the existing CodeMirror editor and edit manually.
- Mark any section as `@studio:custom` (opaque, preserved across re-generation).
- Drop out of workflow entirely and use raw SQL mode (existing migration-studio behavior).
- Rerun workflow in reconcile mode (re-syncs intent graph from current SQL/DB state).

## 12. Implementation Blueprint

### 12.1 Package Structure

All workflow/tool code lives within `plugin-migration-studio` and `sdk`. No new packages.

**SDK additions** (`packages/sdk/src/`):
- `studio-types.ts` — intent graph types, workflow types, gate types.
- `studio-schemas.ts` — Zod schemas for all studio artifacts (validation at boundaries).

**Plugin-migration-studio additions** (`packages/plugin-migration-studio/src/`):
- `tools/` — one file per tool (introspect, sql-parse, intent-sync, intent-init, sql-generate, migration-assemble, rls-plan, rls-verify, function-guard, migration-lint, release-check).
- `workflows/` — workflow definitions (create-endpoint, add-function, update-entity, adopt-backend).
- `engine/` — pipeline runner (~100–150 lines), step executor, checkpoint handler. No external framework.
- `routes/` — HTTP route handlers for workflow API.

**New dependencies** (added to `plugin-migration-studio/package.json`):
- `@supabase/pg-parser` — SQL → AST.
- `pgsql-deparser` — AST → SQL.
- `extract-pg-schema` — column/constraint introspection (evaluate during `studio-introspect` implementation; may not be needed if direct pg_catalog queries are sufficient).

**UI-web additions** (`packages/ui-web/src/dashboard/`):
- New pages: Workbench, EntityModeler, DeployGate, AdoptionReport.
- Shared components: ArtifactViewer, GateDisplay, DiffViewer, PolicyMatrix.

### 12.2 SDK Extensions for Studio

The SDK gains types and validation schemas but no new runtime dependencies:

```
sdk/src/
  studio-types.ts          # IntentGraph, WorkflowStep, WorkflowRun, ReleaseGate, etc.
  studio-schemas.ts        # Zod schemas matching studio-types for artifact validation
  sql-analyzer.ts          # existing — unchanged, continues serving regex-based analysis
  artifacts.ts             # existing — unchanged, used as-is for all artifact I/O
```

The SDK remains dependency-free. `@supabase/pg-parser` and `pgsql-deparser` are dependencies of `plugin-migration-studio` only — they are not needed by other plugins or by core.

### 12.3 API Contract Additions

New routes on the migration-studio HTTP server:

| Route | Method | Purpose |
|---|---|---|
| `/api/workflows` | GET | List available workflow definitions |
| `/api/workflows/:id/runs` | GET | List runs for a workflow |
| `/api/workflows/:id/start` | POST | Start a new workflow run |
| `/api/runs/:id` | GET | Get run status + step results |
| `/api/runs/:id/resume` | POST | Resume from checkpoint |
| `/api/runs/:id/retry` | POST | Retry from failed step |
| `/api/runs/:id/cancel` | POST | Cancel a running workflow |
| `/api/runs/:id/events` | GET (SSE) | Stream run progress events |
| `/api/artifacts/:runId` | GET | List artifacts produced by a run |
| `/api/artifacts/:runId/:artifactId` | GET | Get specific artifact |
| `/api/intent-graph` | GET | Current intent graph |
| `/api/intent-graph` | PUT | Update intent graph (user edits) |
| `/api/adoption-report` | GET | Latest adoption report |

### 12.4 Persistence Model

Workflow state is persisted as artifacts in `.sbt/artifacts/` using the existing artifact infrastructure:
- `studio.workflow.run@1.0.0` — run metadata, step status, timestamps.
- All tool outputs are already artifacts by definition.
- User approvals/overrides stored as fields within the run artifact.

No separate database for workflow state. The artifact directory is the source of truth. This keeps the system simple and file-based, consistent with the rest of the tooling.

### 12.5 Required Invariants

- Same inputs + versions => same outputs (deterministic generation).
- Every apply action references a release-gate artifact that passed.
- No implicit mutation of opaque or excluded SQL regions.
- Every destructive change requires explicit user confirmation (recorded in run artifact).
- Snapshot hash mismatch between plan-time and apply-time blocks execution.
- Intent graph is never modified by tools — only by explicit user action or the init/sync workflow.

## 13. Contract and Compatibility Governance

### 13.1 Artifact Versioning

- Artifact schemas are defined as Zod schemas in `sdk/src/studio-schemas.ts`.
- Breaking shape changes create a new major version (e.g., `studio.intent.graph@2.0.0`).
- Schema files are committed to the repo and validated in CI.
- Tools declare which artifact versions they consume/produce. Version mismatch is a hard error.

### 13.2 Backend Compatibility

Support matrices should be explicit for:
- Postgres server versions (minimum: 14, target: 15+). `@supabase/pg-parser` supports PG 15/16/17 syntax.
- Supabase platform assumptions (PostgREST conventions, auth schema layout).
- Feature flags for advanced SQL capabilities (e.g., GENERATED ALWAYS AS, partitioning).

## 14. Testing and Verification Strategy

1. **Tool contract tests**
- Validate artifact shape matches Zod schema.
- Determinism: same input → same output across runs.
- Error model: invalid input produces typed error, not crash.

2. **Parser round-trip tests**
- Parse SQL with `@supabase/pg-parser` → extract intent nodes → regenerate SQL with `pgsql-deparser` → parse again → compare ASTs.
- Ensures round-trip fidelity for all supported DDL constructs.
- Identifies constructs where regenerated SQL is semantically equivalent but syntactically different (acceptable) vs. semantically different (bug).

3. **Generation golden tests**
- SQL outputs for fixed intent graph inputs remain stable.
- Changes to generation logic require updating golden files (forces review).

4. **Brownfield adoption fixtures**
- Real-world legacy schemas: Supabase SaaS template, multi-tenant with RLS, schema with extensions (PostGIS, pgvector).
- Partial migration histories (some applied, some pending).
- Mixed manual SQL alongside generated SQL.
- Verify confidence scoring produces expected managed/opaque classification.
- Verify opaque blocks have `astAvailable: true` (parser works) with correct `reason` (semantic, not syntactic limitation).

5. **Change classification tests**
- For each change class in §7.4: verify correct SQL strategy, rollback SQL, and gate behavior.
- Expand/contract tests: verify multi-step migration generation for renames and type changes.
- Edge cases: rename + type change combined, drop column referenced by policy, add NOT NULL to populated table.

6. **Workflow integration tests**
- Full workflow execution with mock DB.
- Checkpoint behavior (pause, resume, reject).
- Error recovery (fail mid-workflow, retry from failed step).
- Drift detection (DB changes between plan and apply).

7. **End-to-end tests**
- Workflow execution against ephemeral PGlite/Docker Postgres.
- Greenfield: create entity → generate → apply → verify in DB.
- Brownfield: seed DB → adopt → update entity → apply → verify.

## 15. Key Risks and Required Mitigations

1. **Round-trip lossiness**
- Mitigation: `@supabase/pg-parser` gives us a complete AST for all valid Postgres SQL — parsing is not the bottleneck. Lossiness comes from semantic modeling gaps (what the intent graph can't represent). Opaque blocks with `astAvailable: true` preserve everything the parser understood. Coverage expands incrementally by adding new intent graph node types.

2. **Unsafe abstraction for novices**
- Mitigation: hard gates (no apply without passing release check), explainability (every decision shows SQL and reasoning), deny-by-default security (RLS enabled, no public grants).

3. **Brownfield complexity**
- Mitigation: managed-scope boundaries, gradual adoption mode, excluded status for objects users don't want managed. System schemas (auth, storage) excluded by default.

4. **Schema drift during review**
- Mitigation: snapshot hash in release gate, mandatory re-introspect before apply, automatic invalidation of stale plans.

5. **Workflow engine over-engineering**
- Mitigation: no external framework. Hand-rolled pipeline runner (~100–150 lines). Linear steps with conditional skip. No DAGs, no actor models, no distributed state. Extend only when concrete use cases demand it.

6. **WASM parser performance/compatibility**
- Mitigation: `@supabase/pg-parser` lazy-loads WASM (~3KB JS entrypoint). Parsing runs once during `studio-sql-parse`, not on every keystroke. If WASM proves problematic in a specific environment, the regex `sql-analyzer` provides a degraded-but-functional fallback for risk detection (not AST extraction).

7. **Dependency on external libraries**
- Mitigation: `@supabase/pg-parser` is maintained by the Supabase community (aligned ecosystem). `pgsql-deparser` is pure TypeScript (no native deps, easy to fork if abandoned). `extract-pg-schema` is optional (evaluate, not commit). Total new dependency surface is <100KB, no native binaries, no runtime services.

## 16. Decision Register (Resolved)

1. **SQL parser strategy** — Use `@supabase/pg-parser` (WASM, real PG parser) for AST extraction. Keep existing regex `sql-analyzer` for fast risk detection. Use `pgsql-deparser` for AST→SQL generation. All three coexist with distinct roles.

2. **IR schema ownership** — TypeScript-first with Zod validation. Intent graph types live in `sdk/src/studio-types.ts`, schemas in `sdk/src/studio-schemas.ts`. Evolution follows artifact versioning rules (§13.1).

3. **Managed/opaque boundary representation** — Stored in the intent graph itself (`managedStatus` per node + `ManagedScope` at graph level). No separate manifest file. Changes to managed scope are tracked as intent graph version diffs.

4. **Workflow definition format** — TypeScript objects in `plugin-migration-studio/src/workflows/`. Not JSON/YAML. Keeps type checking, allows conditional logic in `skipWhen`, colocates with tool imports. No external workflow framework.

5. **Release-gate override policy** — Warnings can be acknowledged (stored in run artifact). Blocking errors cannot be overridden without fixing the issue. No admin bypass. This may need revisiting for emergency hotfix scenarios — defer until the gate system is in use.

6. **Compatibility policy** — Existing migrations that predate studio are never modified. Studio appends new migrations to the existing sequence. The adoption workflow reads existing migrations for intent extraction but marks them as historical/read-only.

7. **Schema diffing strategy** — Build our own, operating on intent graph diffs (structured TypeScript objects), not raw SQL or live DB comparison. Adopt pgroll's expand/contract pattern for non-additive changes. No external Go binary dependency.

## 17. Implementation Priorities

Ordered by dependency and value delivery:

1. **Add dependencies and validate parsing pipeline**:
- Add `@supabase/pg-parser` and `pgsql-deparser` to `plugin-migration-studio`.
- Build a proof-of-concept: parse a real Supabase migration file → walk AST → extract entities and policies → deparse back to SQL.
- Validate that the round-trip is faithful for common DDL patterns.
- This de-risks the entire architecture before building anything else.

2. **Define artifact schemas** in `sdk/src/studio-types.ts` and `sdk/src/studio-schemas.ts`:
- `studio.intent.graph@1.0.0` (the full IntentGraph type from §9.1)
- `studio.schema.snapshot@1.0.0`
- `studio.sql.ast@1.0.0`
- `studio.intent.sync-report@1.0.0`
- `studio.rls.plan@1.0.0`
- `studio.migration.plan@1.0.0`
- `studio.migration.lint@1.0.0`
- `studio.release.gate@1.0.0`

3. **Implement brownfield adoption chain** (proves the hardest part first):
- `studio-introspect` → `studio-sql-parse` → `studio-intent-sync` → `studio-intent-init`
- This validates the SQL→intent direction and the confidence model.
- Test against brownfield fixtures (Supabase SaaS template, multi-tenant with RLS, extensions).

4. **Implement workflow engine** (minimal):
- Pipeline runner (~100–150 lines), step executor, checkpoint handling, persistence via artifacts.
- Wire up the adoption workflow as the first real workflow.

5. **Implement greenfield CRUD workflow end-to-end**:
- `intent-init` → `rls-plan` → `rls-verify` → `sql-generate` → `migration-assemble` → `migration-lint` → `release-check`
- This validates the intent→SQL direction and the gate system.

6. **Implement entity update workflow** with change classification:
- Change detection via intent graph diffing.
- All change classes from §7.4 with SQL strategies.
- Expand/contract pattern for renames and type changes.
- Drift detection and plan invalidation.

7. **Build UI surfaces** in dashboard:
- Workbench (workflow runs).
- Entity Modeler (intent graph editor with SQL preview via `pgsql-deparser`).
- Deploy Gate (release check results).
- Adoption Report (brownfield confidence map).

---

This architecture keeps SQL execution authoritative while allowing progressive abstraction for non-SQL users. It uses mature open-source libraries (`@supabase/pg-parser`, `pgsql-deparser`) for the hard problems (parsing, deparsing) and builds only what is domain-specific (intent graph modeling, workflow orchestration, change classification, security gates). The brownfield model, expand/contract migration strategy, and opaque block preservation ensure that the platform can manage what it understands and safely preserve what it doesn't.
