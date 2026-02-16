---
"@sbtools/sdk": patch
"@sbtools/core": patch
---

**Documentation:** Update VitePress docs to reflect refactoring changes — add `buildAtlasUI()`, `SchemaFilter`, `loadPackageVersion()`, and `withHelp()` to SDK docs; update writing-plugins guide with recommended `buildAtlasUI()` pattern; correct package count and note merged packages in architecture docs.

**Plugin loader:** Add graceful handling for `@sbtools/plugin-atlas-html` and `@sbtools/plugin-docs-server` — these packages were merged into core as of v0.3.0. The loader now detects them in config and prints a helpful warning instead of crashing.

**Convention linter:** Add `scripts/lint-conventions.ts` with 10 rules enforcing project conventions (use `ui.*` instead of `console.log`, use `SbtError` subclasses, wrap commands with `withHelp()`, use `buildAtlasUI()`, parameterized schema filters, avoid separator comment banners, etc.). Run via `npm run lint:conventions` — emits advisory warnings only, does not fail builds.
