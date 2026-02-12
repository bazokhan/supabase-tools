---
"@sbtools/sdk": minor
"@sbtools/core": minor
"@sbtools/plugin-erd": patch
"@sbtools/plugin-typegen": patch
"@sbtools/plugin-depgraph": patch
"@sbtools/plugin-db-test": patch
---

Add `ctx.paths` to PluginContext exposing all resolved config paths

Plugins can now access all root config paths (migrations, tests, snapshot, docsOutput, erdOutput, typesOutput, functions) via `ctx.paths` instead of hardcoding defaults. This fixes an issue where `paths.erdOutput`, `paths.typesOutput`, and other root config path settings were silently ignored by plugins.
