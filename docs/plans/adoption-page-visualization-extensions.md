# Plan: Extend Adoption Page Visualizations

Maximize visual value from intent graph and adoption workflow data using existing libraries (Mermaid, Recharts), tab layout, and optional graph libraries. Includes **tools & workflows** visualization and **business-oriented** metrics for stakeholders.

---

## 1. Existing Assets (Zero New Dependencies)

| Asset | Location | Used For |
|-------|----------|----------|
| **Mermaid** | `MermaidRenderer.tsx` | ER diagrams, flowcharts; dark mode support |
| **Recharts** | `MiniBarChart`, `MiniDonutChart` | Bar, donut/pie charts |
| **Custom SVG graph** | `Depgraph.tsx` | Interactive nodes + edges; zoom/pan; type palette |
| **Intent graph API** | `GET /api/studio/intent-graph` | Full `IntentGraph` (entities, views, functions, triggers, policies, endpoints, opaqueBlocks, managedScope) |

---

## 2. Data Available (Intent Graph)

| Data | Shape | Visual Use |
|------|-------|------------|
| `entities` | id, schema, name, managedStatus, confidence, columns, constraints, indexes | Charts, tables, graph nodes; FK from constraints |
| `policies` | id, entity, name, command, roles, managedStatus | Entity→Policy graph edges; per-entity bar |
| `triggers` | id, entity, name, events, function | Entity→Trigger→Function graph edges |
| `functions` | id, schema, name, args, returnType, security | Graph nodes; security bar chart |
| `views` | id, schema, name, materialized | Graph nodes; type breakdown |
| `endpoints` | id, type, entity, allowedRoles, operations | Endpoint table; type donut (table-crud vs rpc) |
| `opaqueBlocks` | rawSql, sourceSpan, reason | Opaque blocks table + reason breakdown |
| `managedScope` | schemas, explicitExclusions | Schema status summary |

---

## 3. Proposed Layout: Tabbed Sections

```
┌─────────────────────────────────────────────────────────────────┐
│ Adoption Workflow                                                 │
│ [Status pill] [Start/Resume/Restart] [Map Endpoints]              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ [Overview] [Entities] [Graph] [Endpoints] [Policies] [Opaque]    │  ← Tabs
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Tab content                                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Tab Content (Per Tab)

### Tab 1: Overview

- **Stats row**: Counts for entities, views, functions, triggers, policies, endpoints, opaque blocks.
- **MiniDonutChart**: Managed status (managed / assisted / opaque / excluded).
- **MiniBarChart**: Entity count per schema (or policy count per entity).
- **Confidence histogram** (Recharts BarChart): buckets (0–0.5, 0.5–0.8, 0.8–1.0).
- **Mode & scope summary**: `mode`, `managedScope.schemas` summary.

**Libraries**: Recharts (existing).

---

### Tab 2: Entities (current table + enrichment)

- Keep current table (Entity, Schema, Status, Confidence, Actions).
- Add column: **# Policies** (from `policies.filter(p => p.entity === e.id)`).
- Add column: **# Triggers** (from `triggers.filter(t => t.entity === e.id)`).
- Optional: Expandable row to show columns/constraints.

**New dependencies**: None.

---

### Tab 3: Graph (intent graph visualization)

**Option A — Mermaid erDiagram (recommended, no new deps)**  
- Build Mermaid `erDiagram` from entities + FK constraints.
- Render with `MermaidRenderer` (dark mode).
- Edges: `Entity1 ||--o{ Entity2 : "FK"`.
- Cluster by schema if many tables.
- Simple and reliable for entity relationships.

**Option B — Interactive SVG (like Depgraph)**  
- Reuse Depgraph layout/rendering pattern.
- Nodes: entity, function, view, trigger, policy, endpoint.
- Edges: FK, policy→entity, trigger→entity, trigger→function, endpoint→entity.
- Benefit: zoom/pan, selection, type filters.
- Cost: New `buildIntentGraphModel()` in `model.ts`; no new lib.

**Option C — @xyflow/react (React Flow)**  
- Industry-standard interactive graph.
- Auto-layout (dagre), minimap, selection.
- Cost: ~50–80KB gzipped, new dependency.
- Use when: graph is large (>50 nodes) and needs professional UX.

**Recommendation**: Start with Option A (Mermaid). Add Option B if users request interactivity without adding React Flow. Add Option C only if graph size and UX justify it.

---

### Tab 4: Endpoints

- Table: Endpoint ID, Type (table-crud / rpc / view), Entity, Exposed via, Allowed roles, Operations.
- **MiniDonutChart**: table-crud vs rpc vs view counts.
- **MiniBarChart**: Endpoints per entity (top N).
- Data from `intentGraph.endpoints` (populated by Map Endpoints).

**Libraries**: Recharts.

---

### Tab 5: Policies

- Table: Policy ID, Entity, Command, Roles, Managed status.
- **MiniBarChart**: Policy count per entity.
- **MiniDonutChart**: Command breakdown (SELECT / INSERT / UPDATE / DELETE / ALL).
- Link to entity in Entities tab.

**Libraries**: Recharts.

---

### Tab 6: Opaque Blocks (when present)

- Table: ID, Source (file:lines), Reason, Touched objects.
- **MiniDonutChart**: Reason breakdown (unrepresentable / user-excluded / too-complex).
- Expandable row with `rawSql`.
- Shown only when `opaqueBlocks.length > 0`.

**Libraries**: Recharts.

---

## 5. Implementation Checklist

| Task | Effort | Notes |
|------|--------|-------|
| Fetch full IntentGraph instead of only `entities` | S | Update `fetchIntentGraph` typings and state |
| Add tab layout (Overview, Entities, Graph, Endpoints, Policies, Opaque) | M | Tab component or simple button-tabs |
| Overview: stats + MiniDonut + MiniBar + confidence histogram | M | Reuse existing chart components |
| Entities: keep table, add Policy/Trigger counts | S | Derive from `policies`, `triggers` |
| Graph tab: Mermaid erDiagram from entities + FK | M | `buildIntentMermaid(entities)` helper |
| Endpoints tab: table + donut + bar | M | New tab content |
| Policies tab: table + bar + donut | M | New tab content |
| Opaque tab: table + donut, conditional render | S | Gate on `opaqueBlocks.length` |
| Optional: Intent graph model + Depgraph-style SVG | L | If Mermaid is insufficient |

---

## 6. Library Choices Summary

| Need | Choice | Rationale |
|------|--------|-----------|
| Entity-relationship diagram | **Mermaid** | Already in use; reliable; no new deps |
| Bar/pie/donut charts | **Recharts** | Already in use; proven |
| Tab layout | **CSS + state** | No dependency; simple |
| Interactive graph (optional) | **Depgraph pattern** or **@xyflow/react** | Reuse vs industry standard |

---

## 7. Data Flow

```
GET /api/studio/intent-graph
  → full IntentGraph (entities, views, functions, triggers, policies, endpoints, opaqueBlocks, managedScope)
  → Store in React state
  → Each tab derives its view from this single source
```

No extra API calls per tab. Map Endpoints runs once; refresh updates `endpoints` in the stored graph.

---

## 8. Tools & Workflows Visualization

### 8.1 What Exists

| Concept | Source | API |
|---------|--------|-----|
| Adoption workflow | `adopt-backend` | `GET /api/studio/adopt/status`, `POST /api/studio/adopt/start`, `POST /api/studio/adopt/resume` |
| Release gate | `runReleaseGate` | `POST /api/studio/release-gate` |
| RLS check | `runRlsCheck` | `POST /api/studio/rls-check` |
| Migration lint | `runMigrationLint` | `POST /api/studio/migration-lint` |
| RPC lint | `runRpcLint` | `POST /api/studio/rpc-lint` |
| Migration plan | `runMigrationPlan` | `POST /api/studio/migration-plan` |

### 8.2 Workflow Pipeline (Mermaid flowchart)

Render the **adopt-backend** workflow as a flowchart:

```
introspect → sql-parse → [review checkpoint] → intent-sync → [approve checkpoint] → intent-init
```

- Nodes: step name + artifact produced.
- Edges: data flow; checkpoint nodes styled differently (diamond or callout).
- Status overlay: completed (green), running (spinner), failed (red), not started (gray).
- Reuse `MermaidRenderer` with `flowchart` or `flowchart LR`.

### 8.3 Validation Pipeline (Mermaid flowchart)

Render the **validation pipeline** that feeds release gate:

```
rls-check → rpc-lint → migration-lint → release-gate
```

- Each tool produces an artifact; release-gate aggregates.
- Show which tools have been run (evidence in gate) vs missing.
- Link to Run buttons per tool.

### 8.4 Tool Grid / Run Matrix

- **Tool** | **Last run** | **Status** | **Output** | **Run**.
- Derive "last run" from artifact `generatedAt` (requires read endpoints for artifacts, or run-on-demand and show result).
- Status: pass/fail from artifact (rls report, migration lint) or from gate evidence.

*Note: Artifacts are on disk; no GET endpoints exist for them. Options: (a) add `GET /api/studio/artifacts/:id` to read latest artifact, or (b) run tools on-demand from UI and display result. Option (b) is already used for release-gate.*

---

## 9. Business-Oriented Visualizations

Translate technical data into metrics stakeholders care about: **readiness**, **risk**, **progress**, and **API surface**.

### 9.1 Release Readiness Scorecard

| Metric | Source | Display |
|--------|--------|---------|
| **Gate status** | `ReleaseGate.status` | Large pass/fail badge; green/red |
| **Blocking issues** | `ReleaseGate.blocking.length` | Count + list; "3 issues must be fixed" |
| **Warnings** | `ReleaseGate.warnings.length` | Count; "2 warnings to review" |
| **Evidence** | `ReleaseGate.evidence` | "Checked: RLS, RPC, Lint" or "Missing: run rls-check, rpc-lint, lint" |

**Visual**: Card/summary at top of Adoption or a dedicated "Release Readiness" tab. One-click "Run Gate" to refresh.

### 9.2 Risk Overview

| Risk Type | Source | Business Language |
|-----------|--------|-------------------|
| **RLS gaps** | `RlsReportData.gaps` | "X tables lack RLS policies — data may be exposed" |
| **Destructive changes** | `MigrationPlanData.destructiveCount` | "X destructive changes pending — review before apply" |
| **Migration lint errors** | `MigrationLintData.errorCount` | "X lint errors in migration files" |
| **RPC security** | `RpcPlanData.securityDefinerCount`, `missingSearchPathCount` | "X functions use definer; Y lack search_path — security risk" |
| **Opaque blocks** | `IntentGraph.opaqueBlocks.length` | "X SQL regions not fully modeled — manual review needed" |

**Visual**: MiniDonut or horizontal bar for risk categories. Color-coded: red (blocking), amber (warning), green (ok).

### 9.3 Adoption Progress

| Metric | Source | Display |
|--------|--------|---------|
| **Workflow %** | `WorkflowRun.steps` completed / total | Progress bar: "75% complete (3/4 steps)" |
| **Managed scope** | `IntentGraph.entities` by managedStatus | "X managed, Y assisted, Z opaque" |
| **Endpoint coverage** | `IntentGraph.endpoints` vs entities | "X of Y tables exposed as API endpoints" |

**Visual**: Progress bar for workflow; donut for managed vs unmanaged.

### 9.4 API Surface (Business Value)

| Metric | Source | Display |
|--------|--------|---------|
| **Total endpoints** | `IntentGraph.endpoints.length` | "N API endpoints" |
| **Table CRUD** | Endpoints with `type: "table-crud"` | "X REST table endpoints" |
| **RPC** | Endpoints with `type: "rpc"` | "X RPC endpoints" |
| **Coverage** | Managed entities with endpoints / total managed | "X% of managed tables exposed" |

**Visual**: Stat cards; "Your backend exposes N endpoints to the frontend."

### 9.5 Migration Health

| Metric | Source | Display |
|--------|--------|---------|
| **Pending changes** | `MigrationPlanData.changes.length` | "X changes queued" |
| **Safe vs risky** | `additive_safe` vs `destructive` | "Y safe, Z require review" |
| **Change classes** | Group by `ChangeClass` | Bar: additive_safe | additive_with_default | drop | …

**Visual**: Bar chart; tooltip with remediation hints.

### 9.6 Suggested Business-Oriented Tabs

| Tab | Audience | Content |
|-----|----------|---------|
| **Readiness** | PM, Tech Lead | Release gate, blocking count, evidence, Run Gate |
| **Risk** | Security, Ops | RLS gaps, destructive changes, RPC security, opaque blocks |
| **Progress** | PM | Workflow %, managed scope donut, adoption checklist |
| **API Surface** | Product | Endpoint counts, table vs RPC split, coverage % |
| **Tools** | Dev | Workflow flowchart, validation pipeline, tool run matrix |

### 9.7 Combined Tab Structure (Technical + Business)

```
[Readiness] [Progress] [Risk] [API Surface] | [Overview] [Entities] [Graph] [Endpoints] [Policies] [Opaque] [Tools]
     ↑────────── Business-focused ──────────↑     ↑──────────── Technical / Developer ────────────────↑
```

- **Readiness** — Gate status, blocking/warnings, one-click Run Gate.
- **Progress** — Workflow completion %, managed scope, adoption checklist.
- **Risk** — Aggregated risk categories with business language.
- **API Surface** — Endpoint counts, coverage.
- **Overview** — Stats, donuts, confidence (technical overview).
- **Entities** — Table with Manage/Exclude.
- **Graph** — Mermaid ER or interactive.
- **Endpoints** — Endpoint table + charts.
- **Policies** — Policy table + charts.
- **Opaque** — Unmodeled SQL blocks.
- **Tools** — Workflow + validation flowcharts, tool run matrix.

---

## 10. Benefits Summary

- **No new deps for core features**: Mermaid + Recharts + custom tabs.
- **Full data usage**: Every major IntentGraph field has at least one visual.
- **Tabs**: Clear separation; manageable complexity.
- **Charts**: Status distribution, schema breakdown, confidence, endpoints, policies.
- **Graph**: Entity relationships (Mermaid) with optional interactive SVG later.
- **Opaque blocks**: Visibility into unmodeled SQL.
- **Endpoints**: Clear table and charts instead of only a count pill.
- **Tools & workflows**: Adoption and validation pipelines as flowcharts; tool run status.
- **Business-oriented**: Release readiness scorecard, risk overview, adoption progress, API surface metrics — language stakeholders understand.
