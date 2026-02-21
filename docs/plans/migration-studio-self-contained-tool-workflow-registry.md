# Plan: Migration Studio Single-Source Tool/Workflow Registry (Behavior-Preserving)

## Goal

Refactor `@sbtools/plugin-migration-studio` so that:

1. Each tool is a self-contained module in `src/tools/` (logic + template/schema/constants it needs).
2. Each workflow is defined in its own module in `src/workflows/`.
3. `src/index.ts` (CLI commands) and `src/server.ts` (HTTP routes) are composed from these modules as a single source of truth.
4. Behavior and outputs remain the same (no intentional functionality changes).
5. Every tool file includes a bottom-level metadata object with plain-English, non-technical description for non-technical users.
6. New tools/workflows can be added by adding files that follow conventions (drop-in extensibility), not by editing central manual wiring.

## Constraints (From Request)

- Keep tools in a folder, with many small single-purpose files.
- Tools are isolated and pure in responsibility; not aware of other tools or workflows.
- Workflows orchestrate tools by ID and are defined separately.
- Avoid introducing broad new architecture layers (no domain/infrastructure reorg).
- Avoid drastic command-folder restructuring to preserve similarity with other plugins.
- Tool metadata must be understandable by non-technical users.

## Current Problems

- `src/index.ts` and `src/server.ts` both manually import and wire the same tool functions.
- CLI and HTTP adapters duplicate validation/mapping logic per tool.
- Tool metadata (name/help/path/input contract) is split across multiple files.
- Adding a new tool requires touching many places (tool file, index wiring, server wiring, help text, route map).

## Proposed Design

### 1. Self-Contained Tool Modules (Canonical)

For each tool, standardize a module export that includes:

- `id` (stable tool identifier)
- `cli` metadata:
  - command name
  - help text
  - arg parser
  - handler adapter
- `http` metadata (optional per tool):
  - method/path
  - body parser
  - handler adapter
- `run` implementation (existing tool logic reused; no behavior change)
- `metadata` object (at bottom of file) with plain-English fields for non-technical users, e.g.:
  - `whatItDoes`
  - `whenToUse`
  - `whatItNeeds`
  - `whatItProduces`

Where applicable, move tool-specific constants/templates/schemas into the same tool module folder.

### 2. Workflow Modules as Canonical Definitions

Keep workflow definitions in `src/workflows/*`, but reference tool IDs from the tool registry instead of ad-hoc imports in multiple places.

### 3. Convention-Based Discovery (Drop-In)

Replace manual registry maintenance with convention-based discovery:

- `src/tools/` discovery: load files matching a naming convention (for example `*.tool.ts` / emitted `*.tool.js`) and collect exported tool definitions.
- `src/workflows/` discovery: load files matching workflow naming convention (for example `*.workflow.ts` / emitted `*.workflow.js`) and collect exported workflow definitions.

This enables adding:
- a tool by adding one new tool file
- a workflow by adding one new workflow file (list of tool IDs)

No manual import lists in `index.ts`/`server.ts`.

### 4. Generate CLI Commands from Discovered Tools

Refactor `src/index.ts` to:

- Build `commands` array from tool registry metadata.
- Keep plugin shape and command UX unchanged.
- Preserve existing command names/help/output.

### 5. Generate HTTP Route Map from Discovered Tools

Refactor `src/server.ts` to:

- Build route map from tool registry metadata.
- Keep existing endpoints and JSON shapes unchanged.
- Preserve non-tool routes (`/api/health`, SSE/events, schema cache, migrations file read, etc.).

## Implementation Steps

1. Add local contracts for `StudioToolDefinition` and `StudioWorkflowDefinition`.
2. Add discovery loaders for tools/workflows (naming convention based).
3. Convert one tool (`studio-add-column`) to full self-contained module (including plain-English metadata) and verify parity.
4. Convert remaining tools to self-contained modules; co-locate tool-specific constants/templates/schemas where relevant.
5. Refactor `index.ts` to build CLI commands from discovered tool definitions.
6. Refactor `server.ts` to build route map from discovered tool definitions.
7. Update workflow files to reference tool IDs only; discover workflows by convention.
8. Ensure help text, route paths, and output/error behavior remain unchanged.
9. Run tests/build and parity checks.

## Safety and Parity Strategy

- No SQL-generation logic rewrites unless required for module boundary extraction.
- Preserve current command names and route paths exactly.
- Preserve artifact read/write behavior and filenames.
- Preserve exit/error semantics from existing handlers.
- Make changes incrementally with compile/test checks after each phase.
- Enforce metadata presence in tool contract so each tool exports non-technical description.

## Test Plan

1. Existing tests:
   - Run migration-studio package tests and ensure all pass.
2. Build checks:
   - Build `@sbtools/plugin-migration-studio` and dependent packages if needed.
3. Targeted parity checks:
   - CLI: `studio-add-column`, `studio-create-table`, `studio-release-gate`.
   - HTTP: `POST /api/studio/scaffold/add-column`, `POST /api/studio/release-gate`, `GET /api/studio/intent-graph`.
4. Regression checks:
   - Workflow start/resume behavior and checkpoint handling.

## Non-Goals

- No UI redesign.
- No broad monorepo architecture changes outside plugin-migration-studio.
- No command-system redesign in core or other plugins.
- No behavior/API contract change intended.

## Deliverables

- Refactored self-contained tool modules.
- Convention-based tool/workflow discovery (no manual central wiring edits for additions).
- `index.ts` and `server.ts` composed from registry metadata (duplicate manual wiring removed).
- Plain-English metadata object at bottom of each tool module.
- Passing tests/build with behavior parity.
