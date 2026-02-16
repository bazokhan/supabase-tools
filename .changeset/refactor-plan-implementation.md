---
"@sbtools/sdk": patch
"@sbtools/core": patch
"@sbtools/plugin-db-test": patch
"@sbtools/plugin-typegen": patch
"@sbtools/plugin-logs": patch
"@sbtools/plugin-deno-functions": patch
"@sbtools/plugin-depgraph": patch
"@sbtools/plugin-migration-audit": patch
"@sbtools/plugin-frontend-usage": patch
"@sbtools/plugin-scaffold": patch
---

Refactoring plan implementation: small gaps (withHelp, console.log), C5 (schema filter parameterized queries), 4G (Atlas UI builder).

- **withHelp()** applied to plugin-db-test, plugin-typegen; core watch command
- **ui.info** replaces console.log in plugin-logs viewer
- **C5** — getSchemaFilter returns `{ clause, params }`; extractors use parameterized queries
- **4G** — sdk/atlas-ui.ts builder; plugin-logs, deno-functions, depgraph, migration-audit, frontend-usage migrated; scaffold uses buildAtlasUI([])
- Fixes D6 (DRY triad), C8 (escapeHtml implicit global)
