---
"@sbtools/sdk": minor
"@sbtools/core": minor
"@sbtools/plugin-erd": patch
"@sbtools/plugin-typegen": patch
"@sbtools/plugin-depgraph": patch
"@sbtools/plugin-db-test": patch
"@sbtools/plugin-atlas-html": patch
"@sbtools/plugin-deno-functions": patch
"@sbtools/plugin-frontend-usage": patch
"@sbtools/plugin-logs": patch
---

Decouple plugin-specific config from core; add `ctx.paths` for shared infrastructure

**Breaking (0.1.0):**
- `ctx.functionsPath` and `ctx.docsOutput` removed from `PluginContext` — use `ctx.paths.functions` and `ctx.paths.docsOutput`
- `erdOutput`, `typesOutput` removed from root config `paths` — configure in `plugins[].config`
- `paths.tests` removed from root config — configure `testsDir` in plugin-db-test's `plugins[].config`
- `erd` section removed from root config — configure `displayColumns` in plugin-erd's `plugins[].config`

Core now only owns shared infrastructure paths (migrations, snapshot, docsOutput, functions). Plugins own their specific config via `pluginConfig`. Community plugins can manage their own settings without modifying core.
