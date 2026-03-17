# supabase-tools — Project State Analysis

> Written: 2026-03-17 | Version at time of writing: 0.9.0 (pre-1.0)

---

## Executive Summary

`@sbtools/*` is a local Supabase development toolkit built around one insight: **LLMs should be able to drive your entire Supabase backend lifecycle programmatically.** It is not a replacement for the Supabase dashboard — it's what the Supabase dashboard would be if it had an API-first, AI-first design philosophy.

The core value chain:
```
sbt start → sbt snapshot → sbt studio-introspect → sbt studio-intent-init
→ (LLM calls POST /api/studio/* tools) → sbt studio-release-gate → sbt migrate
```

At ~v0.9, the platform is functionally complete for the core use case. The biggest gap is the absence of an MCP server, which would make every tool a first-class callable for AI agents like Claude, Cursor, and Copilot.

---

## Competitive Position

| Tool | Their Strength | Our Advantage |
|---|---|---|
| **Supabase Dashboard** (official) | Polished hosted UI, team features, realtime | HTTP tool surface, intent graph, LLM-callable, local-first |
| **Supabase CLI** | Official support, managed hosting ops | Intent graph, release gate, brownfield adoption, plugin system |
| **Prisma Migrate** | Mature TypeScript ORM, large ecosystem | Supabase-specific (RLS, RPC, Edge Functions), no ORM lock-in |
| **Drizzle** | TypeScript-native ORM | Same — no Supabase-specific tooling |
| **pgAdmin / TablePlus** | Rich query UI, schema visualization | Zero automation, no LLM surface |
| **Atlas (ariga.io)** | Declarative schema migration, drift detection | LLM-callable tools, Supabase-specific artifacts, intent tracking |

**Differentiator in one sentence:** sbtools gives an LLM a typed, cataloged, self-describing HTTP tool surface over your Supabase project — no other tool does this.

---

## Strong Functionalities (Ship-Ready, Competitive Differentiators)

These are the most valuable parts of the project. They work well and have no real equivalent elsewhere.

### 1. Migration Studio HTTP Tool Surface (port 3335)

**21 tools** auto-discovered from `*.tool.ts` files, each exposing both `sbt studio-<tool>` (CLI) and `POST /api/studio/<tool>` (HTTP). LLMs can call any tool with structured input and get structured JSON output.

This is the core value proposition. No Supabase tooling competitor provides this.

**Key routes:**
- `GET /api/studio/catalog` — LLM discovers all available tools at runtime
- `POST /api/studio/introspect` — Get current DB schema as typed nodes
- `POST /api/studio/sql-parse` — Parse migration files to AST
- `POST /api/studio/release-gate` — Pass/fail gate before applying
- `POST /api/studio/scaffold/*` — Generate migration SQL

### 2. Intent Graph

The `IntentGraph` (`.sbt/artifacts/studio.intent.graph`) tracks every DB entity with a `managedStatus`:
- `managed` — LLM has full confidence, schema matches SQL
- `assisted` — partial match, LLM should review
- `opaque` — unknown origin, LLM should not touch without human sign-off

This is unique. No other tool has a formalized "confidence model" for brownfield Supabase codebases. An LLM can read this graph and know exactly which parts of the DB it can safely modify.

### 3. Release Gate

`studio-release-gate` aggregates outputs from 4 validation tools into a single `{ status: 'pass' | 'fail', reasons: GateReason[] }` signal. The migration apply route (`POST /api/apply`) respects this gate.

Perfect for LLM-driven pipelines: LLM generates SQL → validates → gate says pass → apply. No human needed unless gate fails.

### 4. Catalog System

`GET /api/studio/catalog?audience=backend-dev&mode=managed&type=tools` returns a filtered list of tools with structured metadata:
- `whatItDoes` — one-line description
- `whenToUse` — conditional guidance
- `whatItNeeds` — prerequisite artifacts
- `whatItProduces` — output artifacts
- `audience` — backend-dev / business / mixed
- `controlModes` — managed / assisted / loose

An LLM can read this catalog to self-orient in a project without needing to understand the codebase.

### 5. Artifact System

All tool outputs write to `.sbt/artifacts/` as versioned JSON envelopes (`ArtifactEnvelope<T>`). LLMs can read cached artifacts without re-running expensive DB queries. Staleness is tracked via `snapshotHash`.

13 artifact types, all with semantic versioning and backward-compatible schema.

### 6. Brownfield Adoption Workflow

4-step pipeline with human checkpoints:
1. `studio-introspect` → live DB schema
2. `studio-sql-parse` → migration file AST
3. `studio-intent-sync` → confidence scoring (0.0–1.0 per entity)
4. `studio-intent-init` → build IntentGraph with managedStatus classification

Handles the realistic case: a Supabase project that evolved organically, with SQL of unknown origin. Nothing else in the ecosystem addresses this.

### 7. Dual CLI + HTTP Surface

Every tool has both interfaces. CLI for humans and scripts; HTTP for LLMs and automation. The same core logic, zero duplication (via `*.core.ts` pattern). Consistent, well-typed.

---

## Complete & Stable (Done, Low Priority)

These work, are tested, and don't need significant attention.

| Component | Status | Notes |
|---|---|---|
| **plugin-erd** | Done | Mermaid ERD per table, dashboard integrated |
| **plugin-depgraph** | Done | Interactive HTML graph, tested |
| **plugin-typegen** | Done | TS types via Supabase API |
| **plugin-migration-audit** | Done | Drift detection, HTML report |
| **plugin-logs** | Done | Docker log tailing, pg_stat_statements |
| **plugin-deno-functions** | Done | Edge function docs, OpenAPI spec |
| **plugin-frontend-usage** | Done | SDK usage scanner |
| **8 scaffold tools** | Done | create-table, add-column, add-index, add-constraint, add-rls-policy, add-function, create-rpc, create-view |
| **4 diagnostic tools** | Done | introspect, sql-parse, intent-sync, intent-init |
| **Workflow engine** | Done | Sequential pipeline with checkpoints |
| **Dashboard SPA** | Done | 14 pages, SSE refresh, dark mode, Ctrl+K search |
| **Core CLI** | Done | start, stop, restart, status, migrate, snapshot, watch, dashboard, init, plugin |

---

## Good But Missing Something

These have real value but a specific gap limits their impact.

### A. No MCP Server ← BIGGEST GAP

**Impact: HIGH | Effort: MEDIUM**

LLMs today use tools via [MCP (Model Context Protocol)](https://modelcontextprotocol.io/). Every tool in the catalog is a perfect MCP tool definition — it already has `name`, `description`, `inputSchema` (from Zod), and `outputSchema`.

Currently, to use these tools an LLM must:
1. Know the HTTP API exists on port 3335
2. Construct raw HTTP requests
3. Parse raw JSON responses

With an MCP server, an LLM would:
1. See `studio-introspect`, `studio-release-gate`, etc. listed as first-class tools
2. Call them with typed arguments
3. Get structured responses

The HTTP API is already there. This is mostly a mapping layer: `catalog tools → MCP tool definitions`. A new `@sbtools/mcp-server` package or `sbt mcp` command.

**This single addition would make sbtools a top-tier LLM development tool.**

---

### B. RLS Check Has 4 TODO Placeholders

**Impact: MEDIUM | Effort: LOW**

`packages/plugin-migration-studio/src/tools/core/studio-rls-check.core.ts` has 4 `// TODO: replace with real access expression` comments. The RLS check tool runs correctly, but outputs placeholder text in the USING/WITH CHECK clauses instead of real expressions derived from entity data.

The tool produces a report that says "you need RLS policies" but the suggested `USING` clauses are `/* real access expression */`. This undercuts the value of the tool for LLM-driven policy generation.

---

### C. Schema Builder — No Feedback Loop

**Impact: MEDIUM | Effort: MEDIUM**

The `/schema-builder` page in the dashboard has good form UI for visually creating tables and RLS policies. It calls `POST /api/studio/scaffold/create-table` etc. and shows the generated SQL.

What's missing: after generating a migration file, the intent graph is not updated. The round-trip is:
- Generate SQL → write file → **nothing**

What it should be:
- Generate SQL → write file → re-run `studio-sql-parse` → show intent graph delta → show how confidence changed

Without this loop, Schema Builder feels like a SQL snippet tool rather than a design environment.

---

### D. No Natural Language → Migration Flow

**Impact: HIGH | Effort: LOW**

The entire tool surface is ready for LLM-driven generation. But there's no workflow that takes a human-readable description and produces a migration:

> "Add a posts table with user_id foreign key and RLS that lets users read their own posts"

This could be a new workflow: `describe → generate-create-table → generate-add-rls-policy → studio-release-gate`. Most of the work is prompt engineering; the tools are all there.

This is the most impactful missing feature for the LLM-first use case.

---

### E. greenfield-init Is Thin

**Impact: LOW-MEDIUM | Effort: LOW**

`studio-greenfield-init` creates an empty `IntentGraph` with `mode: 'greenfield'`. That's it. It doesn't scaffold directory structure, suggest initial migrations, or guide the user through starting a new project.

Compare to the brownfield adoption workflow (4 steps, human checkpoints, confidence scoring). Greenfield deserves equivalent depth.

---

### F. No Studio Server Authentication

**Impact: LOW | Effort: LOW**

Port 3335 has zero auth. Any local process can call `POST /api/apply` and run migrations. This is fine for personal local dev, but is a concern if the dashboard is ever exposed to a shared network (e.g., team dev VM, CI environment).

A simple `STUDIO_TOKEN` env var check on state-mutating routes would close this.

---

### G. README Is Stale

**Impact: MEDIUM | Effort: LOW**

`README.md` references the removed `atlas-html` command and lists `migration-studio` as a single command. It doesn't mention the 21 `studio-*` tools, the intent graph, the release gate, or the LLM-first design. First impression for new users (and LLMs reading the repo) is misleading.

---

## Unimportant / Low Value

These exist but don't align well with the LLM-first use case. Not worth investing in further.

| Component | Why Low Value |
|---|---|
| **plugin-scaffold** | Internal dev utility for creating new plugins. The plugin ecosystem is mature; rarely needed. |
| **`docs` command** | Starts Swagger/ReDoc/SchemaSpy servers. LLMs don't consume visual documentation UIs. The dashboard already covers most of this. |
| **`atlas-html` command** | Generates static HTML from atlas data. The dashboard shows this live. Redundant for anyone using the dashboard. |
| **Mermaid ERD (plugin-erd)** | Diagrams are nice for humans but LLMs need structured data, not SVG. `studio-introspect` already returns the same schema as typed JSON. |
| **Recharts charts in Adoption page** | Visual charts look good in the dashboard but their underlying data is more useful to LLMs as plain JSON. The charts add UI complexity without enabling new capabilities. |

---

## Low Hanging Fruits (High Impact, Low Effort)

In priority order:

### 1. MCP Server Package

Create `@sbtools/mcp-server`. The HTTP API is already there. The catalog already has all the metadata needed for MCP tool definitions (`name`, `description`, `inputSchema`). This is a thin translation layer.

```
sbt mcp  →  starts MCP server (stdio transport)
            LLMs see all catalog tools as first-class MCP tools
```

Likely 200-400 lines of code. Enormous leverage.

### 2. Fix the 4 RLS TODO Placeholders

In `studio-rls-check.core.ts`, replace `/* real access expression */` with actual USING clause generation based on entity data (e.g., `auth.uid() = user_id`). The entity graph has the column info needed to make reasonable suggestions.

### 3. Update README.md

Remove `atlas-html`. Add:
- `studio-*` commands overview (3-4 sentences + table)
- Intent graph concept (2 sentences)
- LLM usage section showing how an AI agent would use the HTTP API
- Updated quick start that leads with the main value prop

### 4. `GET /api/studio/llm-context` Endpoint

Single endpoint that returns everything an LLM needs to orient itself:
```json
{
  "intentGraph": { "entityCount": 12, "managedCount": 8, "opaqueCount": 2 },
  "artifactFreshness": { "schema.snapshot": "2h ago", "intent.graph": "fresh" },
  "catalog": [ ...tools with metadata... ],
  "pendingMigrations": 1
}
```

An LLM can call this once at the start of a session and have full project context. Currently requires 4+ separate calls.

### 5. `sbt release-check` One-Shot CLI Command

The `release-check` workflow exists but requires starting the studio server and calling the workflow API. Add a single CLI command that:
1. Starts a transient studio server
2. Runs the release-check workflow to completion (no checkpoints)
3. Prints pass/fail + reasons
4. Exits with code 0 (pass) or 1 (fail)

Ideal as a pre-push git hook or CI step.

### 6. Delete Completed Plan Files

See the Documentation Audit section below. 24+ plan files in `docs/plans/` represent completed work and add noise. Deleting them reduces clutter without losing any information (it's in git history).

### 7. `studio-migration-lint` HTTP Alias

The `studio-lint` tool has a CLI alias `studio-migration-lint` but the HTTP route is only `POST /api/studio/lint`. Add `POST /api/studio/migration-lint` as an alias for consistency.

---

## Documentation Audit

### DELETE These Files (outdated / completed / irrelevant)

| File | Reason |
|---|---|
| `docs/plugins/plugin-atlas-html.md` | Plugin merged into core, package no longer exists |
| `docs/plugins/plugin-docs-server.md` | Plugin merged into core, package no longer exists |
| `docs/plans/migration-studio-react-parity.md` | Completed — studio page is live |
| `docs/plans/migration-studio-server-plus-ui-web-page.md` | Completed — server + page are live |
| `docs/plans/migration-studio-ui-parity.md` | Completed |
| `docs/plans/cli-runner-page.md` | Completed — Runner page is live |
| `docs/plans/depgraph-usability-upgrade.md` | Completed |
| `docs/plans/frontend-usage-dashboard-v1.md` | Completed |
| `docs/plans/dashboard-animation-elegance-refresh.md` | Completed |
| `docs/plans/dashboard-first-run-ops-ux.md` | Completed |
| `docs/plans/dashboard-live-ops-and-install-flow.md` | Completed |
| `docs/plans/migration-studio-next-phase.md` | Superseded by current state |
| `docs/plans/migration-studio-p3-p4-adoption-engine.md` | Completed — adoption engine is live |
| `docs/plans/migration-studio-workflows-platform.md` | Completed — workflows are live |
| `docs/plans/plugin-migration-studio-cleanup-unused-files-and-code.md` | Completed |
| `docs/plans/plugin-migration-studio-collapse-legacy-tools-layer.md` | Completed |
| `docs/plans/plugin-migration-studio-tool-metadata-persona-modes.md` | Completed — catalog has this |
| `docs/plans/plugin-migration-studio-unify-test-filenames.md` | Completed |
| `docs/plans/plugin-migration-studio-unify-tool-filenames.md` | Completed |
| `docs/plans/migration-studio-self-contained-tool-workflow-registry.md` | Completed |
| `docs/plans/tool-workflow-catalog-filter-surface.md` | Completed |
| `docs/plans/workflow-real-db-e2e-matrix-and-assertions.md` | Completed |
| `docs/plans/workflow-unit-and-e2e-tests-with-db-fallback.md` | Completed |
| `docs/plans/update-onboarding.md` | Stale — onboarding is now complete |
| `docs/.vitepress/dist/` | **Entire folder** — generated build artifacts; should be gitignored, not committed |

### UPDATE These Files (stale content)

| File | What to Update |
|---|---|
| `README.md` | Remove `atlas-html`; add `studio-*` overview; add LLM/MCP usage section |
| `docs/cli-reference.md` | Remove `atlas-html`; add all 21 `studio-*` commands with descriptions |
| `docs/plugins/plugin-migration-studio.md` | Rewrite with full tool catalog, 4 workflows, HTTP routes, LLM usage guide |
| `docs/plugins/plugin-migration-studio-platform.md` | Update to reflect current 5-layer architecture (Understand/Design/Generate/Validate/Apply) |
| `docs/getting-started.md` | Add migration studio + LLM usage quick start |
| `docs/plugins/index.md` | Remove dead plugins (`plugin-atlas-html`, `plugin-docs-server`); promote migration-studio as primary plugin |

### KEEP AS-IS (current and accurate)

- `CLAUDE.md` / `AGENTS.md` — synchronized, accurate
- `docs/architecture/` — artifact contracts, package dependencies are accurate
- `docs/writing-plugins.md` — plugin contract is stable
- `docs/configuration.md` — config schema is stable
- `docs/plugins/plugin-migration-studio-contributing.md` — contributor guide is current
- Per-package `README.md` files — accurate

---

## Recommended Next Steps (In Order)

1. **MCP Server** — single highest-leverage addition; turns the existing HTTP surface into a first-class LLM tool
2. **Fix RLS TODO placeholders** — small correctness fix, high signal quality improvement
3. **`GET /api/studio/llm-context`** — makes the platform self-describing for AI agents
4. **`sbt release-check` one-shot command** — enables LLM-driven CI gate without managing server lifecycle
5. **Documentation cleanup** — delete 24 stale plan files, update README, update migration-studio docs
6. **Natural language → migration workflow** — highest-impact product feature for the target use case

---

## Implementation Checklist

Ordered from least to most effort. Check off as completed.

### Housekeeping
- [x] Gitignore `.claude/settings.local.json`
- [x] Untrack committed `docs/.vitepress/dist/` files from git (were not tracked; already gitignored)
- [x] Delete stale plan files (22 files deleted from `docs/plans/`)
- [x] Delete `docs/plugins/plugin-atlas-html.md`
- [x] Delete `docs/plugins/plugin-docs-server.md`

### Small Code Fixes
- [x] Fix 4 RLS TODO placeholders in `studio-rls-check.core.ts` — now infers `auth.uid() = <col>` from column names, falls back to `auth.uid() IS NOT NULL`
- [x] `studio-migration-lint` HTTP alias — already correct (`/api/studio/migration-lint`); no change needed

### Documentation Updates
- [x] Update `README.md` — removed `atlas-html`, added full `studio-*` tool table, added LLM usage section
- [x] Update `docs/cli-reference.md` — already comprehensive and accurate; no changes needed
- [x] Update `docs/plugins/index.md` — promoted migration-studio description
- [x] Update `docs/plugins/plugin-migration-studio.md` — rewritten with full tool catalog, HTTP routes, LLM guide
- [x] Update `docs/plugins/plugin-migration-studio-platform.md` — added `studio-release-check`, updated quick start
- [x] Update `docs/getting-started.md` — added LLM/agent quick start with HTTP workflow

### New Features (Medium Effort)
- [x] Add `GET /api/studio/llm-context` endpoint — returns intent graph summary, artifact freshness, tool catalog, migration count
- [x] Add `sbt studio-release-check` one-shot CLI command — runs release-check workflow, exits 0/1, supports `--json`

### New Features (High Effort)
- [ ] Schema Builder feedback loop — after scaffold, auto-run sql-parse and show intent graph delta
- [ ] Natural language → migration workflow — describe intent → generate SQL → validate → gate
- [x] MCP server package (`@sbtools/mcp-server`) — expose all catalog tools as MCP tool definitions

---

## Architecture Health

The codebase is in good shape:

- **Zero circular deps** — SDK has no runtime deps; plugins have no compile-time dep on core
- **Convention-based discovery** — tools and workflows are auto-discovered; adding a new tool is just a new file
- **Artifact versioning** — all 13 artifact types use semver envelopes; backward-compatible by design
- **Test coverage** — 9/11 packages have tests; ~200 tests; E2E DB matrix in migration-studio
- **Technical debt** — 4 TODO comments (all in one file); no FIXME/HACK elsewhere
- **Build order** — correctly enforced: sdk → ui-web → packages → copy-dashboard

The main risk is the `docs/.vitepress/dist/` folder being committed to git — it's a large generated artifact that should be gitignored.
