---
"@sbtools/sdk": minor
"@sbtools/core": minor
"@sbtools/plugin-depgraph": minor
"@sbtools/plugin-frontend-usage": minor
"@sbtools/plugin-logs": minor
"@sbtools/plugin-migration-audit": minor
"@sbtools/plugin-deno-functions": minor
"@sbtools/plugin-scaffold": minor
---

Remove legacy Atlas UI code (Phase 5 of ui-modernization-plan.md).

**Breaking**

- **SDK**: Remove `getAtlasView`, `PluginAtlasView`, `buildAtlasUI`, `AtlasSectionDef`, `AtlasCardDef`, `AtlasBadgeDef`, `AtlasDetailDef`, `AtlasSummaryDef`
- **Core**: Remove `sbt atlas-html` command and entire `src/atlas/` directory (12 files). Remove `atlas` subcommand from `sbt docs`.
- **Plugins**: Remove `getAtlasView`, `atlas.ts`, and `atlas/styles.ts` from depgraph, frontend-usage, logs, migration-audit, deno-functions.

**Replacement**

Use `sbt dashboard` instead of `sbt atlas-html`. Plugins contribute via `getDashboardView()` (JSON-serializable config). The dashboard aggregates `backend-atlas-data.json` and displays all plugin sections.
