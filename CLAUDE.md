# Claude Code — Project Notes

## GitHub Issues

**Labels:** Use standard GitHub labels (`bug`, `enhancement`, `documentation`) plus project-specific labels for affected areas (e.g. `plugin-system`, `path-resolution`). Create area labels as needed — use them to make filtering useful, not for decoration.

**Titles:** Should reflect the actual scope found during investigation, not just the reporter's initial description. Keep them concrete and scannable — state *what's broken* or *what's needed*, not the solution.

**Comments:** When posting an investigation or fix summary, include: what was found (root cause), what was changed (files + rationale), and any backward-compat notes. Use tables for multi-item comparisons.

**Scope expansion:** If an issue turns out to be broader than reported, update the title and labels to match the real scope. Note the expansion in your comment so the reporter understands.

## Build

- Monorepo with npm workspaces under `packages/`
- SDK must build first: `npm run build` handles this (builds sdk, then all workspaces)
- All packages use TypeScript with `tsc`

## Changesets

This repo uses `@changesets/cli`. Create changesets for any package whose public API or behavior changes. Group related changes into one changeset when they're part of the same fix.
