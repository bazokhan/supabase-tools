# Comprehensive UI Improvement Plan

Every actionable improvement for the `ui-web` dashboard, SSR pages, and Migration Studio — organized by category with exact file paths, root causes, and implementation details.

---

## Table of Contents

1. [CSS Architecture — Eliminate Token Duplication](#1-css-architecture--eliminate-token-duplication)
2. [Broken Links — External Pages Opening Overview](#2-broken-links--external-pages-opening-overview)
3. [Details Page — Graph Node Detail View](#3-details-page--graph-node-detail-view)
4. [Font Consistency — Migration Studio](#4-font-consistency--migration-studio)
5. [Data Tables — ValueRenderer Integration](#5-data-tables--valuerenderer-integration)
6. [Badge Component — Expand Usage Everywhere](#6-badge-component--expand-usage-everywhere)
7. [Stat Cards — Consistent Coloring and Tones](#7-stat-cards--consistent-coloring-and-tones)
8. [Logs Page — Remove Arbitrary Height Limit](#8-logs-page--remove-arbitrary-height-limit)
9. [ERD Plugin — Dashboard Integration](#9-erd-plugin--dashboard-integration)
10. [Charts and Diagrams — Data Visualization](#10-charts-and-diagrams--data-visualization)
11. [Tooltips — Expand to All Interactive Elements](#11-tooltips--expand-to-all-interactive-elements)
12. [Loading States — Skeleton Placeholders](#12-loading-states--skeleton-placeholders)
13. [Transitions and Animations](#13-transitions-and-animations)
14. [Dropdown Component](#14-dropdown-component)
15. [SSR Renderer Cleanup — Remove Inline pageCss](#15-ssr-renderer-cleanup--remove-inline-pagecss)
16. [Sidebar Component Cleanup](#16-sidebar-component-cleanup)
17. [Table UX — Sorting, Pagination, Column Resize](#17-table-ux--sorting-pagination-column-resize)
18. [Empty States — Consistent Design](#18-empty-states--consistent-design)
19. [Responsive Layout Polish](#19-responsive-layout-polish)
20. [Keyboard Navigation and Accessibility](#20-keyboard-navigation-and-accessibility)
21. [Search UX — Close on Navigate, Keyboard Support](#21-search-ux--close-on-navigate-keyboard-support)
22. [Graph Visualization — Canvas Interaction](#22-graph-visualization--canvas-interaction)
23. [Migration Studio — Deeper Style Alignment](#23-migration-studio--deeper-style-alignment)
24. [Icon Expansion — Type-Specific Icons](#24-icon-expansion--type-specific-icons)
25. [Implementation Priority](#25-implementation-priority)

---

## 1. CSS Architecture — Eliminate Token Duplication

### Problem

Design tokens (CSS custom properties) are defined in **four** places with identical or near-identical values:

| File | What it defines | Consumed by |
|------|----------------|-------------|
| `packages/ui-web/src/styles/tokens.css` (lines 1-76) | `:root` + `.dark` block with all tokens | Dashboard SPA (via Vite import in `main.tsx`) |
| `packages/ui-web/src/styles/shared-tokens.ts` | `SHARED_TOKENS_LIGHT`, `SHARED_TOKENS_DARK`, `SHARED_TOKENS_CSS` | SSR pages, Migration Studio |
| `packages/ui-web/src/components/document.tsx` (line 5) | Imports `SHARED_TOKENS_CSS` into `baseCss` | SSR renderer (`renderPageFrame`, `renderRawDocument`) |
| `packages/plugin-migration-studio/src/html/styles.ts` (line 4) | Imports `SHARED_TOKENS_DARK` | Migration Studio |

The core problem: `tokens.css` and `shared-tokens.ts` both define the same variable values independently. If you update one, the other is stale.

### Solution

**Option A — Make `tokens.css` the single source, generate `shared-tokens.ts` at build time:**

1. Keep `tokens.css` as the canonical token definition (it's what Vite imports).
2. Add a small build script (`scripts/extract-tokens.ts`) that reads `tokens.css`, extracts the `:root { ... }` and `.dark { ... }` blocks, and writes `shared-tokens.ts` with the exported strings.
3. Run this script as a pre-build step in `packages/ui-web/package.json`.
4. `shared-tokens.ts` becomes a generated file (add to `.gitignore` or commit as artifact).

**Option B — Make `shared-tokens.ts` the single source, import into `tokens.css`:**

1. Convert `shared-tokens.ts` into a build-time CSS generator.
2. In `tokens.css`, remove the `:root`/`.dark` blocks entirely and instead have a Vite plugin or PostCSS plugin that injects the token values from `shared-tokens.ts`.
3. Alternatively, use a simpler approach: have `main.tsx` import `shared-tokens.ts` directly as a `<style>` injection instead of `tokens.css` for the token portion, and keep `tokens.css` for component styles only.

**Option C (Simplest) — Split `tokens.css` into two files:**

1. `tokens.css` → rename to `components.css` (keeps only component/layout rules, lines 78-1097).
2. `main.tsx` imports both: `import "../styles/shared-tokens.css"` + `import "../styles/components.css"`.
3. Generate `shared-tokens.css` from `shared-tokens.ts` at build time, OR maintain `shared-tokens.ts` as source and have it also write a `.css` version.

**Recommended: Option C** — minimal disruption, clear separation.

### Files to Change

| File | Change |
|------|--------|
| `packages/ui-web/src/styles/tokens.css` | Remove `:root` and `.dark` blocks (lines 1-76), keep everything from `* { box-sizing }` onward |
| `packages/ui-web/src/styles/shared-tokens.ts` | Remains the canonical token source |
| `packages/ui-web/src/dashboard/main.tsx` | Add a side-effect import that injects shared tokens into the document, or generate a `.css` file |
| Build config | Add script to sync `shared-tokens.ts` → `shared-tokens.css` if going the CSS file route |

### Scope of Token Deduplication

The following values appear in `shared-tokens.ts` AND `tokens.css` and must be unified:

- All 26 CSS custom properties in `:root` (bg, bg-strong, surface, surface-solid, surface-soft, surface-elevated, border, border-subtle, text, text-muted, accent, accent-strong, accent-hover, accent-muted, secondary, secondary-muted, success, warning, danger, radius-lg, radius-md, radius-sm, font-sans, font-mono, space-*)
- All 20 CSS custom properties in `.dark`
- Note: `tokens.css` has `--radius-lg`, `--radius-sm`, and `--space-*` which `shared-tokens.ts` lacks — these must be added to `shared-tokens.ts`

---

## 2. Broken Links — External Pages Opening Overview

### Problem

Two buttons link to static HTML files that don't exist in the dashboard build directory:

| Location | Link | Expected Behavior |
|----------|------|-------------------|
| `Depgraph.tsx` line 102 | `<a href="/dependency-graph.html">Open Full Graph Page</a>` | Opens the full SSR depgraph page |
| `Migrations.tsx` line 74 | `<a href="/migration-audit.html">Full Audit Report</a>` | Opens the full SSR audit page |
| `App.tsx` line 68 (routeActions) | `href: "/migration-audit.html"` | Same as above |
| `App.tsx` line 73 (routeActions) | `href: "/dependency-graph.html"` | Same as above |

The dashboard server (`packages/core/src/commands/dashboard.ts`, lines 420-442) looks for the file on disk in `dashboardDir`. These `.html` files are SSR-rendered pages that live in `ctx.paths.docsOutput` (e.g. `.sbt/docs/`), not in the dashboard build directory. When not found, the catch-all serves `index.html` (the SPA), which renders the Overview page.

### Solution

**Option A — Add an API route to serve generated HTML pages:**

Add a new route in `dashboard.ts`:

```
if (pathname === "/dependency-graph.html" || pathname === "/migration-audit.html") {
  const docsPath = path.join(ctx.paths.docsOutput, pathname.replace(/^\//, ""));
  if (fs.existsSync(docsPath)) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(fs.readFileSync(docsPath, "utf8"));
    return;
  }
}
```

Insert this BEFORE the `dashboardDir` static file lookup (line 420).

**Option B — Use the existing `/api/fs/file` endpoint:**

Change the links to use the file API:

- `/api/fs/file?scope=docs&path=dependency-graph.html`
- `/api/fs/file?scope=docs&path=migration-audit.html`

This already works (the endpoint returns HTML files with correct MIME type). Update the `href` in:

- `Depgraph.tsx` line 102
- `Migrations.tsx` line 74
- `App.tsx` lines 68 and 73

**Option C — Generate pages on-the-fly via API:**

Add `/api/render/depgraph` and `/api/render/migration-audit` routes that call the renderer functions (`renderDepgraphPage`, `renderMigrationAuditPage`) using live atlas data.

**Recommended: Option A** — cleanest, serves the already-generated HTML from docs output.

### Files to Change

| File | Change |
|------|--------|
| `packages/core/src/commands/dashboard.ts` | Add route for `*.html` files from docsOutput before static file fallback |
| OR `packages/ui-web/src/dashboard/pages/Depgraph.tsx` | Change href to use `/api/fs/file?scope=docs&path=dependency-graph.html` |
| OR `packages/ui-web/src/dashboard/pages/Migrations.tsx` | Change href to use `/api/fs/file?scope=docs&path=migration-audit.html` |
| OR `packages/ui-web/src/dashboard/App.tsx` | Update `routeActions` hrefs |

---

## 3. Details Page — Graph Node Detail View

### Problem

When clicking "Open Detail Page" for a dependency graph node, the detail page renders a minimal, ugly view:

- A `panel-accent` with just the node label and "type · id" as `empty-state` text
- A plain `ul.edge-list` of connected edges
- No visual hierarchy, no metadata cards, no graph context

Compare this to the regular entity detail page which shows a full `detail-grid` of field cards with `ValueRenderer`.

### Current Code (`Details.tsx` lines 125-164)

The `node` branch renders:
- `<h2>Graph Node Detail</h2>` + `<p>{node.label}</p>` + `<p class="empty-state">{node.type} · {node.id}</p>`
- A static `edge-list` with `<code>` tags
- File target links

### Solution

Redesign the graph node detail to be on par with entity details:

1. **Header Section**: Show node label prominently, type as a `Badge`, schema (extractable from node id pattern like `public.tablename`).

2. **Metadata Grid**: Render a `detail-grid` with cards for:
   - **Type**: Badge-styled
   - **Schema**: Extracted from id
   - **ID**: Full identifier
   - **Inbound Edges**: Count badge
   - **Outbound Edges**: Count badge
   - **Total Connections**: Count

3. **Edge Tables**: Replace `ul.edge-list` with two separate styled tables:
   - **Inbound Dependencies** (edges where this node is the target): columns `Source`, `Relationship`, clickable source node
   - **Outbound Dependencies** (edges where this node is the source): columns `Target`, `Relationship`, clickable target node

4. **Navigation**: Each source/target in the edge tables is a clickable link that navigates to that node's detail page.

5. **Visual Polish**:
   - Use `StatCard` for inbound/outbound/total counts
   - Use `Badge` for node type and edge labels
   - Use the same `panel` + `detail-grid` layout as regular details

### Files to Change

| File | Change |
|------|--------|
| `packages/ui-web/src/dashboard/pages/Details.tsx` | Redesign the `target.type === "node"` branch |

---

## 4. Font Consistency — Migration Studio

### Problem

Migration Studio uses `SHARED_TOKENS_DARK` which defines `--font-sans: "Sora", ...` and `--font-mono: "IBM Plex Mono", ...`. The `getStyles()` in `plugin-migration-studio/src/html/styles.ts` references `var(--font-sans)` for `body` and `var(--font-mono)` for `code`/`.cm-scroller`.

However, the Migration Studio is rendered via `renderRawDocument()` in `document.tsx`, which includes a Google Fonts `<link>` loading Sora and IBM Plex Mono. The font **should** work.

Potential issues:
1. **CSS specificity**: `SHARED_TOKENS_DARK` defines variables in `:root`, but `baseCss` (from `SHARED_TOKENS_CSS`) also defines `:root` with light-mode values. Since `baseCss` is prepended and `opts.styles` is appended, the dark tokens should win. But `SHARED_TOKENS_CSS` includes both `:root` (light) AND `.dark` (dark overrides). The Migration Studio page has no `.dark` class on `<html>`, so the light `:root` from `SHARED_TOKENS_CSS` may be fighting with the dark `:root` from `SHARED_TOKENS_DARK`.
2. **Order of `:root` blocks**: After concatenation, the CSS has: `SHARED_TOKENS_LIGHT :root` → `.dark` overrides → `baseCss body/page/table rules` → `SHARED_TOKENS_DARK :root` → Migration Studio rules. The last `:root` block wins for each property, so dark tokens should win. BUT the light `:root` from `SHARED_TOKENS_CSS` also sets `--font-sans: "Sora"`. If Migration Studio's `SHARED_TOKENS_DARK` `:root` also sets `--font-sans: "Sora"`, they should agree. Verify both files have identical font values.
3. **CodeMirror font override**: CodeMirror injects its own font stack via `.cm-editor` styles. The `.cm-scroller { font-family: var(--font-mono) }` in `getStyles()` must have sufficient specificity to override CodeMirror defaults.

### Solution

1. **Verify font-family values match** between `SHARED_TOKENS_LIGHT` and `SHARED_TOKENS_DARK` in `shared-tokens.ts` — they already do ("Sora" and "IBM Plex Mono").
2. **Add `!important` or higher specificity** for `.cm-scroller` and `.cm-editor .cm-content` font-family if CodeMirror overrides it.
3. **Add `font-family: var(--font-sans)` to all text elements** in Migration Studio (buttons, inputs, labels) to ensure nothing falls back to browser defaults.
4. **Test**: Open Migration Studio, inspect body computed font — should be Sora. If not, the Google Fonts `<link>` may not be loading (network issue) or the CSS cascade is wrong.

### Files to Change

| File | Change |
|------|--------|
| `packages/plugin-migration-studio/src/html/styles.ts` | Strengthen font declarations; add `font-family: inherit` to buttons/inputs |
| `packages/ui-web/src/styles/shared-tokens.ts` | Verify font values match in both LIGHT and DARK exports |

---

## 5. Data Tables — ValueRenderer Integration

### Problem

`AppDataTable` and `DataTable` render all cell values using plain `formatValue()` which returns flat strings. Structured data (JSON objects, SQL, arrays) is shown as `[object Object]` or `JSON.stringify` output with no formatting, syntax highlighting, or interactivity.

### Current Code

**`AppDataTable.tsx` (lines 33-39)**:
```tsx
{column.includes("sql") || column === "query" ? (
  <code>{formatValue(row[column])}</code>
) : (
  formatValue(row[column])
)}
```

**`DataTable.tsx` (lines 92-98)**:
```tsx
{col.format === "code"
  ? <code>{formatValue(val, col.format)}</code>
  : formatValue(val, col.format)}
```

### Solution

1. **Replace `formatValue` calls with `<ValueRenderer>`** in both table components.

2. **For `AppDataTable`**: Use `ValueRenderer` with format inference:
   ```tsx
   <td key={column}>
     <ValueRenderer value={row[column]} field={column} format="auto" />
   </td>
   ```

3. **For `DataTable`**: Map `col.format` to `ValueRenderer` format:
   ```tsx
   <td key={col.key}>
     {col.render ? col.render(item) : (
       <ValueRenderer value={val} field={col.key} format={mapFormat(col.format)} />
     )}
   </td>
   ```

4. **Table-optimized rendering**: In table cells, `ValueRenderer` should:
   - Truncate long values with "Show more" expansion
   - Collapse JSON objects by default (show first-level keys only)
   - Keep SQL highlighting but limit to 3 lines with expansion
   - Arrays: show as comma-separated badges if short, collapsible if long

5. **Add a `compact` prop to `ValueRenderer`** for table contexts:
   ```tsx
   <ValueRenderer value={val} field={col.key} format="auto" compact />
   ```
   When `compact=true`:
   - JSON: show `{3 keys}` or `[5 items]` as a badge, expandable on click
   - SQL: show first line + "..." as `<code>`, expandable on click
   - Long strings: truncate at 80 chars with ellipsis

### Files to Change

| File | Change |
|------|--------|
| `packages/ui-web/src/dashboard/components/ValueRenderer.tsx` | Add `compact` prop with truncation logic |
| `packages/ui-web/src/dashboard/components/AppDataTable.tsx` | Replace `formatValue` with `ValueRenderer` |
| `packages/ui-web/src/dashboard/components/DataTable.tsx` | Replace `formatValue` with `ValueRenderer` |
| `packages/ui-web/src/styles/tokens.css` | Add `.value-compact` styles for truncated table cells |

---

## 6. Badge Component — Expand Usage Everywhere

### Problem

The `Badge` component exists with 5 tones (`default`, `good`, `warn`, `bad`, `accent`) but is only used in `GenericSection.tsx` (for card badges). Many places that should use badges render plain text:

| Location | What Should Be a Badge | Currently |
|----------|----------------------|-----------|
| `Migrations.tsx` stat values | Applied/Pending/Missing counts | `<div class="stat-value tone-good">` (inline tone class) |
| `AppDataTable` status columns | `applied`, `pending`, `missing` values | Plain text via `formatValue()` |
| `Logs.tsx` service names | Service name pills | `<button class="tab-btn">` |
| `Logs.tsx` connection status | `Connected`/`Disconnected` | `<span class="live-pill online/offline">` |
| `Overview.tsx` stat panels | Category counts | `<div class="stat-value">` |
| `Details.tsx` edge labels | `references`, `triggers`, etc. | `<span>` |
| `Details.tsx` node type | `table`, `function`, `view`, etc. | `<p class="empty-state">` |
| `DataTable` status-like columns | Any field matching `status`, `type`, `volatility` | Plain text |

### Solution

1. **Add a `tone` inference helper** to the `Badge` component or a utility:
   ```ts
   function inferBadgeTone(value: string, field: string): BadgeTone {
     const v = value.toLowerCase();
     if (v === "applied" || v === "running" || v === "active" || v === "true") return "good";
     if (v === "pending" || v === "warn" || v === "warning") return "warn";
     if (v === "missing" || v === "error" || v === "failed" || v === "false") return "bad";
     if (field === "type" || field === "volatility" || field === "command") return "accent";
     return "default";
   }
   ```

2. **Integrate into `AppDataTable`**: For columns matching `status`, `type`, `volatility`, `command`, `type_kind`, render values as `<Badge>` instead of text.

3. **Integrate into `DataTable`**: Same logic for `format: "text"` columns with status-like field names.

4. **Integrate into `Details.tsx`**:
   - Node type → `<Badge tone="accent">{node.type}</Badge>`
   - Edge labels → `<Badge>{edge.label}</Badge>`

5. **Integrate into `Logs.tsx`**:
   - Connection pill: Replace `.live-pill` with `<Badge tone={connected ? "good" : "bad"}>`.
   - Service status in service health table: Render status as badge.

6. **Integrate into `Migrations.tsx`**:
   - Migration status column in the table already uses `AppDataTable` — will get badges if AppDataTable is updated.

### Files to Change

| File | Change |
|------|--------|
| `packages/ui-web/src/dashboard/components/Badge.tsx` | Add `inferBadgeTone` export, optional `icon` prop |
| `packages/ui-web/src/dashboard/components/AppDataTable.tsx` | Use Badge for status-like columns |
| `packages/ui-web/src/dashboard/components/DataTable.tsx` | Use Badge for status-like columns |
| `packages/ui-web/src/dashboard/pages/Details.tsx` | Use Badge for node type, edge labels |
| `packages/ui-web/src/dashboard/pages/Logs.tsx` | Use Badge for connection status, service status |

---

## 7. Stat Cards — Consistent Coloring and Tones

### Problem

Three different stat rendering approaches exist:

1. **`Migrations.tsx` (lines 118-123)**: Uses raw `<article class="stat-panel">` with manually applied `tone-good`/`tone-warn`/`tone-bad` classes on `stat-value`. "Total" and "Issues" have no tone (default text color).

2. **`Overview.tsx` (lines 58-65)**: Uses raw `<article class="stat-panel">` with no tone at all. All counts are the default text color.

3. **`GenericSection.tsx` (line 74)**: Uses the `<StatCard>` component which properly accepts `tone` prop and applies `stat-tone-*` classes.

The result: migration stats have colors, overview stats have none, generic section stats have colors. Inconsistent.

### Solution

1. **Replace raw stat HTML with `<StatCard>` everywhere**:

   **`Overview.tsx`**: Replace the `stat-grid` section:
   ```tsx
   import { StatCard } from "../components/StatCard";
   // ...
   {stats.map((entry) => (
     <div key={entry.name} onClick={() => setActiveTab(entry.name)}>
       <StatCard
         label={prettyLabel(entry.name)}
         value={entry.count.toLocaleString()}
         tone={entry.name === activeTab ? "accent" : "default"}
       />
     </div>
   ))}
   ```

   **`Migrations.tsx`**: Replace lines 117-123:
   ```tsx
   import { StatCard } from "../components/StatCard";
   // ...
   <div className="stat-grid compact">
     <StatCard label="Total" value={formatValue(summary.total)} />
     <StatCard label="Applied" value={formatValue(summary.applied)} tone="good" />
     <StatCard label="Pending" value={formatValue(summary.pending)} tone="warn" />
     <StatCard label="Missing" value={formatValue(summary.missing)} tone="bad" />
     <StatCard label="Issues" value={formatValue(summary.issues)} tone={Number(summary.issues) > 0 ? "bad" : "default"} />
   </div>
   ```

2. **Unify stat-panel and stat-card CSS**: Currently `tokens.css` has both `.stat-panel` (lines 391-427) and `.stat-card` (lines 429-452) with nearly identical styles. Consolidate into one `.stat-card` class.

3. **Add clickable behavior to `StatCard`**: Add optional `onClick` prop.

### Files to Change

| File | Change |
|------|--------|
| `packages/ui-web/src/dashboard/pages/Overview.tsx` | Use `StatCard` component |
| `packages/ui-web/src/dashboard/pages/Migrations.tsx` | Use `StatCard` component |
| `packages/ui-web/src/dashboard/components/StatCard.tsx` | Add `onClick` prop |
| `packages/ui-web/src/styles/tokens.css` | Remove duplicate `.stat-panel` styles, unify with `.stat-card` |

---

## 8. Logs Page — Remove Arbitrary Height Limit

### Problem

`tokens.css` line 766: `.log-live-surface { max-height: 440px; }` constrains the live log view to a fixed height regardless of screen size. On tall monitors, most of the screen is wasted. On short monitors, 440px may be too much.

### Solution

Replace with a responsive height:

```css
.log-live-surface {
  height: calc(100vh - 320px);
  min-height: 200px;
  max-height: none;
  overflow: auto;
  /* ...rest unchanged... */
}
```

The `320px` accounts for topbar (~80px), panel header (~100px), tab row (~50px), status row (~40px), padding (~50px). Adjust as needed.

Alternatively, use `flex-grow: 1` within a flex container that fills available space:

```css
.log-live-surface {
  flex: 1 1 auto;
  min-height: 200px;
  overflow: auto;
}
```

This requires the parent panel to be a flex column with a set height.

### Files to Change

| File | Change |
|------|--------|
| `packages/ui-web/src/styles/tokens.css` | Change `.log-live-surface` max-height to responsive calc |

---

## 9. ERD Plugin — Dashboard Integration

### Problem

`packages/plugin-erd/src/index.ts` only exposes a `generate-erd` CLI command. It does not implement `getDashboardView()` or `getAtlasData()`, so ERD diagrams are invisible in the dashboard.

The ERD plugin generates Mermaid `.md` files per table in the docs output directory (e.g. `.sbt/docs/entity-relations/tablename.md`).

### Solution

**Phase 1: Add `getAtlasData` to the ERD plugin**

The plugin should read its generated `.md` files and contribute them as a category:

```ts
getAtlasData: async (ctx: PluginContext): Promise<PluginAtlasData> => {
  const erdDir = resolveErdOutput(ctx);
  if (!fs.existsSync(erdDir)) return { categories: {}, stats: [] };

  const files = fs.readdirSync(erdDir).filter(f => f.endsWith(".md"));
  const diagrams = files.map(f => {
    const content = fs.readFileSync(path.join(erdDir, f), "utf8");
    const tableName = f.replace(/\.md$/, "");
    // Extract mermaid block from markdown
    const mermaidMatch = content.match(/```mermaid\n([\s\S]*?)```/);
    return {
      table: tableName,
      mermaid: mermaidMatch?.[1]?.trim() ?? "",
      markdown: content,
    };
  });

  return {
    categories: { erd_diagrams: diagrams },
    stats: [{ label: "ERD Diagrams", value: diagrams.length }],
  };
}
```

**Phase 2: Add `getDashboardView` to the ERD plugin**

```ts
getDashboardView: () => ({
  sections: [{
    id: "erd",
    title: "Entity Relationship Diagrams",
    description: "Mermaid ERD diagrams for each table showing columns and foreign keys.",
    dataKey: "erd_diagrams",
    primaryKeyField: "table",
    layout: "cards",
    card: {
      titleField: "table",
      searchFields: ["table"],
      details: [
        { label: "Mermaid Source", field: "mermaid", format: "code" },
      ],
    },
  }],
})
```

**Phase 3: Render Mermaid in the dashboard**

1. Add a `MermaidRenderer` component to `ui-web/src/dashboard/components/`:
   - Use the Mermaid JS library (dynamically imported) to render `.mermaid` code blocks as SVG.
   - Fallback: show raw Mermaid code in a `CodeBlock`.

2. Integrate into `GenericSection` or as a custom page:
   - When the `ValueRenderer` encounters a field with `format: "code"` and the content starts with `erDiagram`, render it with `MermaidRenderer`.
   - OR: Add a dedicated "ERD" page to the dashboard nav (like Migrations, Depgraph, etc.).

**Phase 4: Add ERD page to dashboard**

Add a new route `/erd` with a dedicated `ErdPage.tsx` that:
- Shows ERD diagrams as rendered Mermaid SVGs in a grid
- Each diagram is expandable (click to see full-size)
- Search/filter by table name
- Shows the raw Mermaid source in a toggle

### Files to Create/Change

| File | Change |
|------|--------|
| `packages/plugin-erd/src/index.ts` | Add `getAtlasData` and `getDashboardView` |
| `packages/plugin-erd/package.json` | May need `fs` / `path` (already available in Node) |
| `packages/ui-web/src/dashboard/components/MermaidRenderer.tsx` | **New**: Component to render Mermaid diagrams |
| `packages/ui-web/src/dashboard/pages/Erd.tsx` | **New**: ERD dashboard page |
| `packages/ui-web/src/dashboard/App.tsx` | Add ERD to nav items and route handling |
| `packages/ui-web/src/dashboard/lib/model.ts` | Add "erd" to `RouteName`, nav items, route prefixes |
| `packages/ui-web/src/dashboard/components/Icons.tsx` | Add `IconErd` icon |
| `package.json` (ui-web) | Add `mermaid` as optional dependency |

---

## 10. Charts and Diagrams — Data Visualization

### Problem

The dashboard has rich data available but presents everything as tables and text. No charts, no trend lines, no distribution visualizations. Specifically:

- **Overview**: Category counts shown as stat numbers — could be a bar chart or donut chart
- **Migrations**: Applied/Pending/Missing ratio — could be a donut/pie chart
- **Migrations**: Timeline of applied migrations — could be a timeline chart
- **Dependency Graph**: Node type distribution — could be a bar chart
- **Dependency Graph**: Edge count distribution per node — could be a histogram
- **Logs/Query Performance**: Execution times — could be a bar chart sorted by total_exec_time
- **Frontend Usage**: Resource type distribution — could be a pie chart
- **Atlas Meta**: Object counts by type — could be a treemap or bar chart

### Solution

**Lightweight charting**: Use a zero-dependency SVG-based chart component library. Options:
- Custom SVG components (no dependency, full control, ~200 lines each)
- `chart.js` + `react-chartjs-2` (well-known, moderate bundle)
- `recharts` (React-native, composable, ~45KB gzipped)
- `@nivo/bar`, `@nivo/pie` (beautiful, but heavier)

**Recommended: Custom SVG mini-charts** for phase 1 (no dependency), upgrade to `recharts` if more complex charts are needed.

### Chart Components to Build

1. **`MiniBarChart`**: Horizontal or vertical bars for category counts
   - Props: `data: { label: string; value: number; tone?: BadgeTone }[]`
   - Used in: Overview (entity counts), Depgraph (node type distribution)

2. **`MiniDonutChart`**: Proportional ring chart
   - Props: `segments: { label: string; value: number; color: string }[]`
   - Used in: Migrations (applied/pending/missing ratio), Frontend Usage (resource type split)

3. **`MiniTimelineChart`**: Horizontal timeline with dots/bars
   - Props: `events: { date: string; label: string; tone?: BadgeTone }[]`
   - Used in: Migrations (applied_at dates as a timeline)

4. **`MiniSparkline`**: Tiny line chart for trends
   - Props: `values: number[]`
   - Used in: Query performance (if time-series data available)

### Integration Points

| Page | Chart | Data Source |
|------|-------|------------|
| `Overview.tsx` | `MiniBarChart` | `stats` array (category counts) |
| `Migrations.tsx` | `MiniDonutChart` | `summary.applied/pending/missing` |
| `Migrations.tsx` | `MiniTimelineChart` | Migration `applied_at` dates |
| `Depgraph.tsx` | `MiniBarChart` | Node type counts from `model.nodes` |
| `Logs.tsx` | `MiniBarChart` | Query execution times (top N) |
| `FrontendUsage.tsx` | `MiniDonutChart` | Hit count by resource type |

### Files to Create/Change

| File | Change |
|------|--------|
| `packages/ui-web/src/dashboard/components/MiniBarChart.tsx` | **New** |
| `packages/ui-web/src/dashboard/components/MiniDonutChart.tsx` | **New** |
| `packages/ui-web/src/dashboard/components/MiniTimelineChart.tsx` | **New** |
| `packages/ui-web/src/dashboard/pages/Overview.tsx` | Add bar chart below stat grid |
| `packages/ui-web/src/dashboard/pages/Migrations.tsx` | Add donut chart + timeline |
| `packages/ui-web/src/dashboard/pages/Depgraph.tsx` | Add node type distribution chart |
| `packages/ui-web/src/dashboard/pages/Logs.tsx` | Add query time chart |
| `packages/ui-web/src/dashboard/pages/FrontendUsage.tsx` | Add resource type donut |
| `packages/ui-web/src/styles/tokens.css` | Add chart-specific CSS |

---

## 11. Tooltips — Expand to All Interactive Elements

### Problem

The `Tooltip` component exists and is used only on the theme toggle button (`App.tsx` line 154). Many other elements would benefit from tooltips.

### Where to Add Tooltips

| Element | Location | Tooltip Content |
|---------|----------|----------------|
| Nav items | `App.tsx` sidebar nav | The `subtitle` text for each nav item (already shown but small) |
| Stat cards | `Overview.tsx`, `Migrations.tsx` | "Click to filter by {category}" or description of what the stat measures |
| Badges | `GenericSection.tsx`, `Details.tsx` | Explanation of the badge value (e.g. "Volatile: result may change between calls") |
| Table headers | `AppDataTable.tsx`, `DataTable.tsx` | Column description (e.g. "Total execution time in milliseconds") |
| External link buttons | `App.tsx` routeActions | "Opens in new tab" |
| Search input | `App.tsx` global search | "Search across all atlas categories" (placeholder already does this) |
| Graph nodes | `Depgraph.tsx` SVG nodes | Full node id + type + schema on hover |
| Timestamp pill | `App.tsx` line 202 | "When atlas data was last generated" |
| Empty states | `EmptyPanel.tsx` | No tooltip needed, but add an info icon with tooltip |

### Implementation

The existing `Tooltip` component works via CSS `:hover`. For SVG elements (graph nodes), use a different approach:

1. **SVG tooltips**: Add a `<title>` element inside each `<g>` in `GraphNodeCell`, which browsers render as native tooltip.
2. **Or**: Use a positioned `<div>` tooltip that follows mouse position, triggered by React `onMouseEnter`/`onMouseLeave`.

### Files to Change

| File | Change |
|------|--------|
| `packages/ui-web/src/dashboard/App.tsx` | Wrap external action links, timestamp pill with Tooltip |
| `packages/ui-web/src/dashboard/pages/Overview.tsx` | Wrap stat cards with Tooltip |
| `packages/ui-web/src/dashboard/pages/Migrations.tsx` | Wrap stat cards with Tooltip |
| `packages/ui-web/src/dashboard/components/AppDataTable.tsx` | Wrap `<th>` with Tooltip |
| `packages/ui-web/src/dashboard/components/DataTable.tsx` | Wrap `<th>` with Tooltip |
| `packages/ui-web/src/dashboard/pages/Depgraph.tsx` | Add `<title>` to SVG nodes |

---

## 12. Loading States — Skeleton Placeholders

### Problem

While data loads, the dashboard shows: `<p>Loading dashboard data...</p>` (a single text line in a blank shell). This feels broken for a modern dashboard.

### Current Code (`App.tsx` lines 39-48)

```tsx
function ShellLoading() {
  return (
    <div className="app-shell">
      <aside className="sidebar-modern" />
      <main className="main-area">
        <section className="panel"><p>Loading dashboard data...</p></section>
      </main>
    </div>
  );
}
```

### Solution

Create a `SkeletonLoader` component with animated placeholder shapes:

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(90deg, var(--surface-soft) 25%, var(--surface-elevated) 50%, var(--surface-soft) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}

.skeleton-text { height: 14px; margin-bottom: 8px; }
.skeleton-heading { height: 22px; width: 200px; margin-bottom: 12px; }
.skeleton-stat { height: 80px; border-radius: var(--radius-md); }
.skeleton-table-row { height: 44px; margin-bottom: 4px; }
```

Update `ShellLoading` to render:
- Skeleton sidebar with nav item shapes
- Skeleton main area with stat grid shapes + table row shapes

### Files to Create/Change

| File | Change |
|------|--------|
| `packages/ui-web/src/dashboard/components/Skeleton.tsx` | **New**: Skeleton components |
| `packages/ui-web/src/dashboard/App.tsx` | Update `ShellLoading` to use skeletons |
| `packages/ui-web/src/styles/tokens.css` | Add skeleton CSS |

---

## 13. Transitions and Animations

### Problem

All UI state changes are instant with no visual feedback:
- Tab switches: content pops in/out
- Theme toggle: instant color switch
- ExpandableCard: instant open/close
- Search popover: has fade-in animation (good), but no fade-out
- Page navigation: instant content swap
- Stat card hover: has `transition: background 0.15s` (good)

### Solution

Add subtle CSS transitions:

1. **Tab content**: Wrap tab content in a container with `opacity` transition:
   ```css
   .tab-content-enter { opacity: 0; transform: translateY(4px); }
   .tab-content-active { opacity: 1; transform: translateY(0); transition: opacity 0.2s ease, transform 0.2s ease; }
   ```

2. **Theme toggle**: Add `transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease` to `body`, `.sidebar-modern`, `.panel`, `.surface`, and other major containers.

3. **ExpandableCard**: Use `max-height` + `overflow: hidden` transition or `grid-template-rows: 0fr → 1fr` pattern:
   ```css
   .expandable-card-body {
     display: grid;
     grid-template-rows: 0fr;
     transition: grid-template-rows 0.25s ease;
   }
   .expandable-card[open] .expandable-card-body {
     grid-template-rows: 1fr;
   }
   ```
   Note: This requires converting from `<details>` to a controlled React component.

4. **Search popover fade-out**: Add exit animation (currently only has enter). Use `onAnimationEnd` or CSS `transition` instead of `@keyframes`.

5. **Page transitions**: Add a simple opacity fade between route changes using React state:
   ```tsx
   const [transitioning, setTransitioning] = React.useState(false);
   // On navigate: setTransitioning(true) → setTimeout → setRoute → setTransitioning(false)
   ```

### Files to Change

| File | Change |
|------|--------|
| `packages/ui-web/src/styles/tokens.css` | Add transition rules for theme, tabs, expandable cards |
| `packages/ui-web/src/dashboard/components/CardGrid.tsx` | Convert `<details>` to controlled component if animating |
| `packages/ui-web/src/dashboard/App.tsx` | Add page transition wrapper |

---

## 14. Dropdown Component

### Problem

Filters are implemented as horizontal button rows (`tab-row` with `tab-btn`). This works for 3-5 options but doesn't scale. The Migrations page has 4 status filters (fine), but the Logs page has dynamic service toggles (could be 10+). There's no reusable dropdown pattern.

### Solution

Create a `Dropdown` component:

```tsx
interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
}
```

Features:
- Click trigger to open/close panel
- Click outside to close
- Keyboard: Escape to close, arrow keys to navigate options
- Animated appear/disappear
- Positioned below trigger, with auto-flip if near viewport edge

### Use Cases

1. **Logs service filter**: Replace the horizontal service toggle buttons with a multi-select dropdown
2. **Page actions**: Replace the `header-action-link` buttons with a "Actions" dropdown containing all external links
3. **Overview tab selector**: When there are 14+ tabs (line 83-95 in Overview.tsx), overflow into a "More..." dropdown

### Files to Create/Change

| File | Change |
|------|--------|
| `packages/ui-web/src/dashboard/components/Dropdown.tsx` | **New** |
| `packages/ui-web/src/styles/tokens.css` | Add dropdown CSS |
| `packages/ui-web/src/dashboard/pages/Logs.tsx` | Use Dropdown for service selector |
| `packages/ui-web/src/dashboard/pages/Overview.tsx` | Use Dropdown for tab overflow |

---

## 15. SSR Renderer Cleanup — Remove Inline pageCss

### Problem

Several SSR renderers define inline CSS strings:

| Renderer | Inline CSS | Content |
|----------|-----------|---------|
| `migration-audit.tsx` line 86 | `pageCss` | `.chipbar` styles (flex, gap, active state) |
| `logs-viewer.tsx` line 93 | `pageCss` | `.toolbar`, `.svc`, `.tabs`, `.tab`, `.pane`, `.log-wrap`, `.log-line` |
| `frontend-usage.tsx` | No inline CSS (uses `renderPageFrame` defaults) | Clean |
| `depgraph.tsx` | No inline CSS | Clean |

These inline styles duplicate patterns already in `tokens.css` / `baseCss`.

### Solution

1. **Move reusable patterns into `baseCss`** (in `document.tsx`):
   - `.chipbar` → add to baseCss as `.chip-bar` (standard naming)
   - `.toolbar` → already in migration-studio but not in baseCss
   - `.tab` / `.tabs` → already have `.tab-btn` / `.tab-row` in baseCss

2. **Update renderers** to use standard class names and remove `pageCss`:
   - `migration-audit.tsx`: Replace `.chipbar button` with `.tab-row .tab-btn` pattern
   - `logs-viewer.tsx`: Replace custom `.tab`, `.toolbar`, `.log-wrap` with standard `.tab-btn`, `.cluster-row`, `.log-live-surface`

3. **Match inline script HTML** in renderers to use the same class names.

### Files to Change

| File | Change |
|------|--------|
| `packages/ui-web/src/components/document.tsx` | Extend `baseCss` with chip-bar, toolbar patterns |
| `packages/ui-web/src/renderers/migration-audit.tsx` | Remove `pageCss`, use standard classes |
| `packages/ui-web/src/renderers/logs-viewer.tsx` | Remove `pageCss`, use standard classes |

---

## 16. Sidebar Component Cleanup

### Problem

There are two sidebar implementations:

1. **Used**: The sidebar is defined inline in `App.tsx` (lines 129-160) as JSX with `nav-link-modern` buttons.
2. **Unused**: `components/Sidebar.tsx` defines a separate `Sidebar` component with `<a>` tags and different class names (`sidebar-link`), plus emoji icons. This component is never imported.

### Solution

Delete the unused `Sidebar.tsx` or refactor `App.tsx` to use it.

**Recommended: Delete** — the `App.tsx` inline sidebar is more feature-complete (icons, enabled/disabled state, tooltips).

### Files to Change

| File | Change |
|------|--------|
| `packages/ui-web/src/dashboard/components/Sidebar.tsx` | **Delete** |

---

## 17. Table UX — Sorting, Pagination, Column Resize

### Problem

Tables show all rows at once (Overview limits to 80), have no sorting, and columns are fixed-width. For tables with many rows or wide content, the experience is poor.

### Solution

1. **Client-side sorting**: Click column headers to sort ascending/descending.
   - Add `sortColumn` and `sortDirection` state.
   - Show sort indicator (arrow icon) in active column header.
   - Apply to both `AppDataTable` and `DataTable`.

2. **Pagination**: For tables with >50 rows, show page controls.
   - Add `page` state, `pageSize` prop (default 50).
   - Show "Page X of Y" with prev/next buttons.
   - Or: infinite scroll with virtualized rendering.

3. **Column resize** (stretch goal): Allow dragging column borders.
   - Use `resize: horizontal` CSS on `<th>` or a custom drag handler.
   - Store widths in component state.

### Files to Change

| File | Change |
|------|--------|
| `packages/ui-web/src/dashboard/components/AppDataTable.tsx` | Add sort state, click handler on `<th>`, sort logic |
| `packages/ui-web/src/dashboard/components/DataTable.tsx` | Add sort state, pagination |
| `packages/ui-web/src/styles/tokens.css` | Add `.sort-indicator`, `.pagination` styles |

---

## 18. Empty States — Consistent Design

### Problem

Empty states are inconsistent:

| Component | Empty State |
|-----------|------------|
| `EmptyPanel` | Panel with title, message, hint — decent |
| `AppDataTable` | `<p class="empty-state">No rows available.</p>` — minimal |
| `DataTable` | `<p class="data-table-empty">No data</p>` — minimal |
| `Logs.tsx` live view | No explicit empty state for 0 lines |
| `Details.tsx` not found | Panel with "Detail Not Found" + `empty-state` |
| `Overview.tsx` | No empty state for 0 categories |

### Solution

Create a unified `EmptyState` component:

```tsx
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}
```

Features:
- Centered layout with icon (e.g. `IconSearch` for no results, `IconAlert` for errors)
- Title in `--text`, message in `--text-muted`
- Optional action button (e.g. "Clear filters", "Run generate-atlas")

Replace all ad-hoc empty states with this component.

### Files to Create/Change

| File | Change |
|------|--------|
| `packages/ui-web/src/dashboard/components/EmptyState.tsx` | **New** (or extend `EmptyPanel.tsx`) |
| `packages/ui-web/src/dashboard/components/AppDataTable.tsx` | Use EmptyState |
| `packages/ui-web/src/dashboard/components/DataTable.tsx` | Use EmptyState |
| `packages/ui-web/src/dashboard/pages/Logs.tsx` | Use EmptyState for 0 lines |

---

## 19. Responsive Layout Polish

### Problem

The responsive breakpoint (`@media max-width: 1120px`) in `tokens.css` handles sidebar collapsing but several areas aren't addressed:

- Graph layout (`graph-layout`) switches to single column (good)
- But the graph SVG has no touch/pinch zoom
- Stat grids don't reflow well on very narrow screens
- Detail grid columns can get too narrow
- No mobile hamburger menu for sidebar

### Solution

1. **Sidebar**: Add a hamburger toggle at mobile widths:
   ```css
   @media (max-width: 768px) {
     .sidebar-modern { display: none; }
     .sidebar-modern.open { display: flex; position: fixed; z-index: 100; }
     .mobile-menu-toggle { display: block; }
   }
   ```

2. **Stat grid**: Ensure `minmax(140px, 1fr)` works, add `@media (max-width: 480px)` to switch to `grid-template-columns: 1fr 1fr`.

3. **Detail grid**: Add `@media (max-width: 640px) { grid-template-columns: 1fr }`.

4. **Tables**: Add horizontal scroll indicator (shadow fade on right edge).

### Files to Change

| File | Change |
|------|--------|
| `packages/ui-web/src/styles/tokens.css` | Add mobile breakpoints |
| `packages/ui-web/src/dashboard/App.tsx` | Add hamburger toggle state |

---

## 20. Keyboard Navigation and Accessibility

### Problem

- Tab order is reasonable but not optimized
- No `aria-label` on most interactive elements
- No keyboard shortcut for global search (e.g. `/` or `Cmd+K`)
- Graph nodes are not keyboard-accessible (click-only SVG `<g>` elements)
- Search popover has no keyboard navigation (arrow keys don't move selection)
- No skip-to-content link

### Solution

1. **Search hotkey**: Add `Cmd+K` / `Ctrl+K` to focus the search input:
   ```tsx
   React.useEffect(() => {
     const handler = (e: KeyboardEvent) => {
       if ((e.metaKey || e.ctrlKey) && e.key === "k") {
         e.preventDefault();
         searchInputRef.current?.focus();
       }
     };
     window.addEventListener("keydown", handler);
     return () => window.removeEventListener("keydown", handler);
   }, []);
   ```

2. **Search popover keyboard nav**: Track `activeIndex`, arrow up/down to move, Enter to select, Escape to close.

3. **Graph nodes**: Add `tabIndex={0}` and `onKeyDown` (Enter/Space to select) to `<g>` elements.

4. **ARIA labels**: Add `aria-label` to:
   - Nav buttons: `aria-label={item.label}`
   - Theme toggle: `aria-label="Toggle dark mode"`
   - Search input: `aria-label="Global search"`
   - Table rows: `aria-label={getPrimaryKey(row)}`

5. **Skip link**: Add `<a href="#main" class="skip-link">Skip to content</a>` before sidebar.

### Files to Change

| File | Change |
|------|--------|
| `packages/ui-web/src/dashboard/App.tsx` | Add search hotkey, skip link, ARIA labels |
| `packages/ui-web/src/dashboard/pages/Depgraph.tsx` | Add keyboard support to graph nodes |
| `packages/ui-web/src/styles/tokens.css` | Add `.skip-link` styles (visually hidden until focused) |

---

## 21. Search UX — Close on Navigate, Keyboard Support

### Problem

The search popover stays open after clicking a result (the page navigates but the popover remains visible with stale results). Also, no keyboard navigation within results.

### Current Code (`App.tsx` lines 188-199)

The search popover renders if `globalMatches.length > 0`, but clicking a result calls `openDetail` which changes the route. However, `searchQuery` is not cleared, so the popover persists until the user manually clears the input.

### Solution

1. **Clear search on navigate**:
   ```tsx
   const openDetail = (section: string, key: string) => {
     setSearchQuery(""); // Clear search
     navigate(`/details?section=...`);
   };
   ```

2. **Close on Escape**: Add `onKeyDown` to search input to clear on Escape.

3. **Close on click outside**: Add a click-outside handler that clears the search.

4. **Arrow key navigation**: Track `highlightedIndex` state, move up/down with arrow keys, Enter to select.

5. **Show search hint**: Display "Ctrl+K" hint inside the search input as a trailing badge.

### Files to Change

| File | Change |
|------|--------|
| `packages/ui-web/src/dashboard/App.tsx` | Clear search on result click, add keyboard nav, click outside handler |

---

## 22. Graph Visualization — Canvas Interaction

### Problem

The SVG graph is static with no zoom, pan, or interactive layout. For large graphs, the fixed coordinate layout (column-based by type) becomes unusable.

### Current Layout Logic (`model.ts` lines 284-301)

Nodes are positioned in a simple grid: column = type index * 260px, row = index within type * 86px. No force-directed layout, no spacing optimization.

### Solution

**Phase 1 — Pan and Zoom:**
- Wrap the SVG in a container with `transform: scale() translate()` controlled by mouse wheel (zoom) and drag (pan).
- Add zoom controls (+ / - buttons, reset button).

**Phase 2 — Better Layout:**
- Implement a simple force-directed layout using a minimal algorithm (Fruchterman-Reingold in ~100 lines).
- Or: Use `d3-force` as an optional dependency for graph layout only.
- The layout runs once on data change and stores positions.

**Phase 3 — Interaction:**
- Hover a node: highlight all connected edges and neighbor nodes.
- Click a node: zoom to neighborhood (already partially implemented via `neighborhood` logic).
- Double-click: open detail page.
- Edge hover: show tooltip with relationship label.

### Files to Change

| File | Change |
|------|--------|
| `packages/ui-web/src/dashboard/pages/Depgraph.tsx` | Add zoom/pan, hover highlights, double-click |
| `packages/ui-web/src/dashboard/lib/model.ts` | Improve `buildGraphModel` layout algorithm |
| `packages/ui-web/src/styles/tokens.css` | Add zoom control CSS |

---

## 23. Migration Studio — Deeper Style Alignment

### Problem

Beyond font consistency (#4), the Migration Studio has several visual differences from the dashboard:

1. **Button styles**: Studio buttons use `border-radius: 8px` while dashboard uses `var(--radius-sm)` (6px). Inconsistent.
2. **Panel styles**: Studio `.panel` uses `border-radius: var(--radius)` which resolves to 12px, matching dashboard.
3. **No stat cards**: Studio has no summary statistics area.
4. **Color hardcoding**: `button.primary:hover` hardcodes `#6366f1` instead of `var(--accent-hover)`.
5. **Missing component patterns**: No badges used in Studio (migration status shown as text classes like `.badge-applied`).
6. **CodeMirror theme**: Gutter background is hardcoded `#09090b` instead of `var(--bg)`.

### Solution

1. **Align button radius**: Change Studio `button { border-radius: 8px }` to `border-radius: var(--radius-md)`.
2. **Fix color hardcoding**: Replace `#6366f1` with `var(--accent-hover)`.
3. **Fix CodeMirror gutter**: Replace `#09090b` with `var(--bg)`.
4. **Use badge pattern**: Replace `.badge-applied { color: var(--success) }` with actual badge styling (background + border + border-radius).
5. **Add stat summary**: If migration data is available in Studio, show Applied/Pending counts as stat cards.

### Files to Change

| File | Change |
|------|--------|
| `packages/plugin-migration-studio/src/html/styles.ts` | Fix hardcoded values, align patterns |

---

## 24. Icon Expansion — Type-Specific Icons

### Problem

Icons exist for navigation (Home, Migrations, Graph, Logs, Frontend, Search, Back, External, File, Moon, Sun) and status (Info, Alert, Check, X), but there are no type-specific icons for database objects.

### Solution

Add monochromatic outline icons for:

| Icon | Use Case |
|------|----------|
| `IconTable` | Table entities in overview/detail |
| `IconFunction` | Function entities |
| `IconView` | View / Materialized View entities |
| `IconTrigger` | Trigger entities |
| `IconPolicy` | Policy / RLS entities |
| `IconEnum` | Enum entities |
| `IconType` | Custom type entities |
| `IconColumn` | Column references |
| `IconKey` | Primary/foreign key indicators |
| `IconDatabase` | Database-level info |
| `IconErd` | ERD section nav icon |
| `IconChart` | Chart/analytics section |
| `IconCopy` | Copy-to-clipboard action |
| `IconExpand` | Expand/collapse toggle |
| `IconFilter` | Filter indicator |

### Usage

1. **Tables**: Show type icon next to entity name in `AppDataTable` when section context is available.
2. **Details page**: Show type icon next to the detail title.
3. **Search results**: Show type icon instead of `IconFile` for known entity types.
4. **Graph nodes**: Show type icon inside the SVG node rectangle.

### Files to Change

| File | Change |
|------|--------|
| `packages/ui-web/src/dashboard/components/Icons.tsx` | Add ~15 new icon components |
| `packages/ui-web/src/dashboard/components/AppDataTable.tsx` | Optionally show type icon |
| `packages/ui-web/src/dashboard/pages/Details.tsx` | Show type icon in header |
| `packages/ui-web/src/dashboard/App.tsx` | Use type icons in search results |

---

## 25. Implementation Priority

Ordered by impact and dependency chain:

### Tier 1 — Critical Fixes (functional bugs)

| # | Item | Section | Effort |
|---|------|---------|--------|
| 1 | Fix broken external links (graph page, audit report) | [§2](#2-broken-links--external-pages-opening-overview) | Small |
| 2 | CSS token deduplication | [§1](#1-css-architecture--eliminate-token-duplication) | Medium |
| 3 | Graph node detail redesign | [§3](#3-details-page--graph-node-detail-view) | Medium |
| 4 | Font consistency in Migration Studio | [§4](#4-font-consistency--migration-studio) | Small |

### Tier 2 — Visual Quality (major UX improvements)

| # | Item | Section | Effort |
|---|------|---------|--------|
| 5 | ValueRenderer in all tables | [§5](#5-data-tables--valuerenderer-integration) | Medium |
| 6 | Badge usage everywhere | [§6](#6-badge-component--expand-usage-everywhere) | Medium |
| 7 | Consistent stat cards | [§7](#7-stat-cards--consistent-coloring-and-tones) | Small |
| 8 | Remove log height limit | [§8](#8-logs-page--remove-arbitrary-height-limit) | Small |
| 9 | Delete unused Sidebar component | [§16](#16-sidebar-component-cleanup) | Tiny |
| 10 | SSR renderer cleanup | [§15](#15-ssr-renderer-cleanup--remove-inline-pagecss) | Medium |

### Tier 3 — Enhanced UX (polish)

| # | Item | Section | Effort |
|---|------|---------|--------|
| 11 | Tooltips everywhere | [§11](#11-tooltips--expand-to-all-interactive-elements) | Medium |
| 12 | Loading skeletons | [§12](#12-loading-states--skeleton-placeholders) | Medium |
| 13 | Transitions and animations | [§13](#13-transitions-and-animations) | Medium |
| 14 | Search UX improvements | [§21](#21-search-ux--close-on-navigate-keyboard-support) | Small |
| 15 | Empty states | [§18](#18-empty-states--consistent-design) | Small |
| 16 | Dropdown component | [§14](#14-dropdown-component) | Medium |
| 17 | Migration Studio deeper alignment | [§23](#23-migration-studio--deeper-style-alignment) | Small |

### Tier 4 — New Features

| # | Item | Section | Effort |
|---|------|---------|--------|
| 18 | Charts and diagrams | [§10](#10-charts-and-diagrams--data-visualization) | Large |
| 19 | ERD plugin dashboard integration | [§9](#9-erd-plugin--dashboard-integration) | Large |
| 20 | Table sorting and pagination | [§17](#17-table-ux--sorting-pagination-column-resize) | Medium |
| 21 | Type-specific icons | [§24](#24-icon-expansion--type-specific-icons) | Medium |
| 22 | Graph interaction (zoom/pan) | [§22](#22-graph-visualization--canvas-interaction) | Large |

### Tier 5 — Accessibility and Responsiveness

| # | Item | Section | Effort |
|---|------|---------|--------|
| 23 | Keyboard navigation | [§20](#20-keyboard-navigation-and-accessibility) | Medium |
| 24 | Responsive layout polish | [§19](#19-responsive-layout-polish) | Medium |

---

## Summary of All New Files

| File | Purpose |
|------|---------|
| `packages/ui-web/src/dashboard/components/MiniBarChart.tsx` | SVG bar chart component |
| `packages/ui-web/src/dashboard/components/MiniDonutChart.tsx` | SVG donut chart component |
| `packages/ui-web/src/dashboard/components/MiniTimelineChart.tsx` | SVG timeline component |
| `packages/ui-web/src/dashboard/components/MermaidRenderer.tsx` | Mermaid diagram renderer |
| `packages/ui-web/src/dashboard/components/Skeleton.tsx` | Loading skeleton placeholders |
| `packages/ui-web/src/dashboard/components/Dropdown.tsx` | Reusable dropdown menu |
| `packages/ui-web/src/dashboard/components/EmptyState.tsx` | Unified empty state component |
| `packages/ui-web/src/dashboard/pages/Erd.tsx` | ERD diagrams page |

## Summary of All Modified Files

| File | Sections |
|------|----------|
| `packages/ui-web/src/styles/tokens.css` | §1, §7, §8, §10, §12, §13, §14, §17, §19, §20 |
| `packages/ui-web/src/styles/shared-tokens.ts` | §1, §4 |
| `packages/ui-web/src/dashboard/main.tsx` | §1 |
| `packages/ui-web/src/dashboard/App.tsx` | §2, §11, §12, §13, §19, §20, §21, §24 |
| `packages/ui-web/src/dashboard/pages/Details.tsx` | §3, §6, §24 |
| `packages/ui-web/src/dashboard/pages/Depgraph.tsx` | §2, §11, §20, §22 |
| `packages/ui-web/src/dashboard/pages/Migrations.tsx` | §2, §7, §10, §11 |
| `packages/ui-web/src/dashboard/pages/Overview.tsx` | §7, §10, §11 |
| `packages/ui-web/src/dashboard/pages/Logs.tsx` | §6, §10, §14 |
| `packages/ui-web/src/dashboard/pages/FrontendUsage.tsx` | §10 |
| `packages/ui-web/src/dashboard/components/AppDataTable.tsx` | §5, §6, §11, §17, §18, §24 |
| `packages/ui-web/src/dashboard/components/DataTable.tsx` | §5, §6, §11, §17, §18 |
| `packages/ui-web/src/dashboard/components/ValueRenderer.tsx` | §5 |
| `packages/ui-web/src/dashboard/components/Badge.tsx` | §6 |
| `packages/ui-web/src/dashboard/components/StatCard.tsx` | §7 |
| `packages/ui-web/src/dashboard/components/CardGrid.tsx` | §13 |
| `packages/ui-web/src/dashboard/components/EmptyPanel.tsx` | §18 |
| `packages/ui-web/src/dashboard/components/Icons.tsx` | §9, §24 |
| `packages/ui-web/src/dashboard/components/Sidebar.tsx` | §16 (delete) |
| `packages/ui-web/src/dashboard/lib/model.ts` | §9, §22 |
| `packages/ui-web/src/components/document.tsx` | §15 |
| `packages/ui-web/src/renderers/migration-audit.tsx` | §15 |
| `packages/ui-web/src/renderers/logs-viewer.tsx` | §15 |
| `packages/core/src/commands/dashboard.ts` | §2 |
| `packages/plugin-erd/src/index.ts` | §9 |
| `packages/plugin-migration-studio/src/html/styles.ts` | §4, §23 |
| `packages/sdk/src/plugin-api.ts` | No changes needed (already has `primaryKeyField`) |

## Estimated Total Effort

- **Tier 1 (Critical)**: ~2-3 days
- **Tier 2 (Visual Quality)**: ~3-4 days
- **Tier 3 (Polish)**: ~3-4 days
- **Tier 4 (New Features)**: ~5-7 days
- **Tier 5 (Accessibility)**: ~2-3 days
- **Total**: ~15-21 days of focused work

Each tier can be implemented independently and shipped as a separate changeset.
