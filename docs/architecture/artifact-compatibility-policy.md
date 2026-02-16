# Artifact Compatibility Policy

This policy defines how artifact schemas evolve and how producers and consumers must behave for backward compatibility.

## Semver behavior

| Bump | Meaning | Consumer impact |
|------|---------|-----------------|
| **MAJOR** | Breaking data schema changes (field removed, type changed, structure changed) | Consumers must be updated to handle the new schema |
| **MINOR** | Additive compatible fields (new optional fields, new categories) | Consumers may ignore unknown fields; safe to upgrade |
| **PATCH** | Docs, bugfix semantics, no structural break | No consumer impact |

## Producer rules

1. **Validate output** against schema before write. Use `validateArtifactEnvelope` before `writeArtifact` in strict mode.
2. **Include freshness inputs** so consumers can detect staleness (e.g. `sourceHash`, `snapshotHash`).
3. **Document confidence limits** where relevant (e.g. "DB unreachable — disk-only analysis").
4. **Never remove or change types** of existing fields in a PATCH or MINOR. Use a new MAJOR for breaking changes.

## Consumer rules

1. **Read exact compatible major** when possible. If you need `migration.analysis` 1.x, accept any 1.y.z.
2. **Tolerate unknown fields** — additive minor changes must not break consumers.
3. **Degrade gracefully** when artifact is missing, invalid, or stale:
   - Show a warning (e.g. "Run migration-audit to refresh")
   - Provide a fallback path (e.g. live computation) when feasible
   - Do not crash or block the user without a clear recovery path
4. **Prefer strict major matching** — do not assume 2.x is compatible with 1.x.

## Deprecation process

1. **Announce** deprecation in release notes and schema docs.
2. **Publish** new major artifact schema with migration notes.
3. **Block** incompatible consumers in CI/integration tests.
4. **Remove** deprecated major after documented cutover release (e.g. 2 releases later).
5. **Update** the [artifact registry](./artifact-registry.md) with deprecation status.

## Contributor checklist

When adding or modifying artifacts:

- [ ] Schema changes follow semver (MAJOR for breaking, MINOR for additive).
- [ ] Producer validates output before write.
- [ ] Consumer degrades gracefully when artifact missing/invalid/stale.
- [ ] Artifact ID is registered in the registry.
- [ ] Contract tests exist for producer and consumer.
- [ ] Migration notes documented for any breaking change.
