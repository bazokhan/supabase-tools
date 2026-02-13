---
"@sbtools/core": minor
"@sbtools/sdk": minor
---

- SDK: Add `sanitizeContainerPrefix`, `deriveContainerPrefix`, `extractSupabaseKeys`, `sanitizeSlug`, `sanitizeIdentifier`; add compose/container/fs-utils tests
- Core: Remove `docs` command from core (now provided by plugin-docs-server); `stop` no longer stops docs compose stack; use SDK container/compose utilities
- plugin-docs-server: Add `docs` command with subcommands (swagger, redoc, atlas, schemaspy, all, stop); per-subcommand preflight
- Plugins: Use shared SDK utilities; improved error handling (SbtError with tips); remove redundant root index.ts
- Docs: Fix extractSupabaseKeys typo; clarify start/stop/restart operate on main stack; document plugin-docs-server requirement for docs commands
