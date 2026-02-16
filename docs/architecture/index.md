# Architecture

Documentation for supabase-tools architecture decisions and cross-package contracts.

## Versioned Artifacts

Versioned artifacts are the contract layer for cross-plugin collaboration. New integrations should use artifact-based contracts instead of implicit file conventions or hook-time object sharing.

- [Artifact ID Registry](./artifact-registry.md) — Official registry of artifact IDs and ownership
- [Artifact Contract Guide](./artifact-contract-guide.md) — How to produce and consume artifacts
- [Artifact Compatibility Policy](./artifact-compatibility-policy.md) — Semver behavior and contributor checklist
- [Implicit File Contracts](./implicit-file-contracts.md) — Documented output paths and merge semantics (legacy; prefer artifacts)

## Related plans

- [Versioned Artifacts Adoption Plan](../../VERSIONED_ARTIFACTS_ADOPTION_PLAN.md) — Full rollout specification
- [Migration Platform Implementation Plan](../../MIGRATION_PLATFORM_IMPLEMENTATION_PLAN.md) — Migration features and platform outcomes
