---
"@sbtools/sdk": minor
"@sbtools/core": minor
"@sbtools/plugin-migration-audit": minor
"@sbtools/plugin-scaffold": patch
---

Versioned artifacts: foundational SDK, core, and migration-audit adoption

**SDK**: Add artifact envelope types, validation helpers, read/write APIs (`writeArtifact`, `readArtifact`, `readArtifactOrNull`), and plugin contract extension (`ArtifactCapabilities`, `artifactsDir` in `PluginContext`).

**Core**: Ensure `.sbt/artifacts/` directory, inject `artifactsDir` into plugin context.

**plugin-migration-audit**: Produce `migration.analysis` artifact (v1.0.0) on every audit run; add `artifactCapabilities`; fix version drift (0.1.0 → 0.4.0 to match package.json).

**plugin-scaffold**: Add commented `artifactCapabilities` template in generated plugin index.

**Docs**: Add architecture section with artifact registry, contract guide, and compatibility policy.
