# Artifact Contract Authoring Guide

This guide explains how to produce and consume versioned artifacts in supabase-tools plugins.

## What is a versioned artifact?

A versioned artifact is a **persisted, typed, semantically-versioned envelope** produced by one package and consumed by one or more others. It replaces implicit file conventions and hook-time object sharing with explicit contracts.

## Envelope structure

Every artifact follows the canonical envelope schema:

```json
{
  "id": "migration.analysis",
  "version": "1.0.0",
  "producer": "@sbtools/plugin-migration-audit",
  "generatedAt": "2026-02-15T00:00:00.000Z",
  "schemaRef": "https://sbtools.dev/contracts/migration.analysis/1.0.0",
  "inputs": {
    "projectRoot": "/workspace",
    "sourceHash": "sha256:...",
    "snapshotHash": "sha256:..."
  },
  "meta": {
    "toolVersion": "0.3.0",
    "buildId": "..."
  },
  "data": {}
}
```

- **id**: Stable identifier (see [artifact registry](./artifact-registry.md)). Never include version in the ID.
- **version**: Full semver (MAJOR.MINOR.PATCH) for schema compatibility.
- **producer**: Package name that produced the artifact.
- **generatedAt**: ISO 8601 timestamp.
- **schemaRef**: Optional URL to schema documentation.
- **inputs**: Fingerprints for freshness/staleness (e.g. source hashes).
- **meta**: Tool/build metadata.
- **data**: The actual payload (schema varies per artifact).

## Storage convention

Default path: `.sbt/artifacts/<artifact-id>/<semver>/latest.json`

Example: `migration.analysis` at `1.0.0` → `.sbt/artifacts/migration.analysis/1.0.0/latest.json`

Optional immutable snapshots: `.sbt/artifacts/<id>/<semver>/<timestamp-or-hash>.json`

## Producer checklist

1. **Validate output** against your schema before write.
2. **Include freshness inputs** (e.g. source hash, snapshot hash) so consumers can detect staleness.
3. **Use the SDK helpers** (`writeArtifact`, `ArtifactEnvelope`) for consistency.
4. **Document confidence limits** where relevant (e.g. "disk-only analysis when DB unreachable").
5. **Register the artifact** in the [artifact registry](./artifact-registry.md).

## Consumer checklist

1. **Read exact compatible major** when possible.
2. **Tolerate unknown fields** (additive minor changes).
3. **Degrade gracefully** when artifact is missing, invalid, or stale — show a warning or fallback, do not crash.
4. **Prefer `readArtifact`** from the SDK for path resolution and validation.

## SDK usage

```typescript
import { writeArtifact, readArtifact, type ArtifactEnvelope } from "@sbtools/sdk";

// Producer
const envelope: ArtifactEnvelope<MyData> = {
  id: "migration.analysis",
  version: "1.0.0",
  producer: "@sbtools/plugin-migration-audit",
  generatedAt: new Date().toISOString(),
  inputs: { projectRoot: ctx.projectRoot, sourceHash: "..." },
  meta: { toolVersion: "0.4.0" },
  data: myAuditResult,
};
writeArtifact(ctx, envelope);

// Consumer
const envelope = readArtifact<MyData>(ctx, "migration.analysis", "1.0.0");
if (!envelope) {
  ui.warn("Migration analysis artifact not found. Run migration-audit first.");
  return;
}
// envelope.data is typed as MyData
```

## Plugin capability declaration

Plugins can declare artifact capabilities in their `SbtPlugin` definition:

```typescript
const plugin: SbtPlugin = {
  name: "@sbtools/plugin-migration-audit",
  version: "0.4.0",
  artifactCapabilities: {
    produces: ["migration.analysis", "migration.lineage", "migration.staleness"],
    consumes: ["snapshot.object-index"],
  },
  // ...
};
```

This enables tooling to validate artifact availability and surface warnings.
