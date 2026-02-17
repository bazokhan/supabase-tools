/**
 * Versioned artifact envelope types and read/write helpers.
 *
 * Artifacts are persisted, typed, semantically-versioned envelopes produced by
 * one package and consumed by others. Storage convention:
 * .sbt/artifacts/<artifact-id>/<semver>/latest.json
 */
import path from "node:path";
import fs from "node:fs";
import type { PluginContext } from "./plugin-api.js";
import { SbtError } from "./errors.js";
import { ensureDir, readText } from "./fs-utils.js";

// ---------------------------------------------------------------------------
// Envelope types
// ---------------------------------------------------------------------------

/** Canonical artifact envelope. `data` holds the typed payload. */
export interface ArtifactEnvelope<T = unknown> {
  /** Stable artifact ID (never include version in ID). */
  id: string;
  /** Full semver (MAJOR.MINOR.PATCH) for schema compatibility. */
  version: string;
  /** Package name that produced the artifact. */
  producer: string;
  /** ISO 8601 timestamp when generated. */
  generatedAt: string;
  /** Optional URL to schema documentation. */
  schemaRef?: string;
  /** Input fingerprints for freshness/staleness. */
  inputs?: Record<string, string>;
  /** Tool/build metadata. */
  meta?: Record<string, string>;
  /** The typed payload. */
  data: T;
}

/** Result of reading an artifact (envelope or null if missing/invalid). */
export type ReadArtifactResult<T> =
  | { ok: true; envelope: ArtifactEnvelope<T> }
  | { ok: false; reason: "missing" | "invalid" | "version_mismatch" };

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;
const ARTIFACT_ID_REGEX = /^[a-z0-9.-]+$/;

/**
 * Validate that an envelope has required fields and valid format.
 */
export function validateArtifactEnvelope<T>(
  envelope: unknown
): envelope is ArtifactEnvelope<T> {
  if (!envelope || typeof envelope !== "object") return false;
  const e = envelope as Record<string, unknown>;

  if (typeof e.id !== "string" || !ARTIFACT_ID_REGEX.test(e.id)) return false;
  if (typeof e.version !== "string" || !SEMVER_REGEX.test(e.version)) return false;
  if (typeof e.producer !== "string" || e.producer.length === 0) return false;
  if (typeof e.generatedAt !== "string" || e.generatedAt.length === 0) return false;
  if (!("data" in e)) return false;

  return true;
}

/**
 * Parse and validate a JSON file as an artifact envelope.
 * Returns the envelope if valid, or null if missing/invalid.
 */
export function parseArtifactEnvelope<T>(raw: string): ArtifactEnvelope<T> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return validateArtifactEnvelope<T>(parsed) ? (parsed as ArtifactEnvelope<T>) : null;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the artifact directory for a given id and version.
 * Does not create directories.
 */
export function artifactDir(sbtDataDir: string, id: string, version: string): string {
  return path.join(sbtDataDir, "artifacts", id, version);
}

/**
 * Resolve the default latest.json path for an artifact.
 */
export function artifactLatestPath(sbtDataDir: string, id: string, version: string): string {
  return path.join(artifactDir(sbtDataDir, id, version), "latest.json");
}

// ---------------------------------------------------------------------------
// Read / Write
// ---------------------------------------------------------------------------

/**
 * Write an artifact envelope to the default path.
 * Creates parent directories as needed.
 */
export function writeArtifact<T>(
  ctx: Pick<PluginContext, "sbtDataDir">,
  envelope: ArtifactEnvelope<T>
): void {
  if (!validateArtifactEnvelope<T>(envelope)) {
    const e = envelope as unknown as { id?: unknown; version?: unknown };
    throw new SbtError("COMMAND_FAILED", `Invalid artifact envelope: id=${e.id}, version=${e.version}`);
  }
  const dir = artifactDir(ctx.sbtDataDir, envelope.id, envelope.version);
  ensureDir(dir);
  const filePath = path.join(dir, "latest.json");
  fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), "utf8");
}

/**
 * Read an artifact from the default path.
 * Returns { ok: true, envelope } or { ok: false, reason }.
 */
export function readArtifact<T>(
  ctx: Pick<PluginContext, "sbtDataDir">,
  id: string,
  version: string
): ReadArtifactResult<T> {
  const filePath = artifactLatestPath(ctx.sbtDataDir, id, version);
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: "missing" };
  }
  let raw: string;
  try {
    raw = readText(filePath);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const envelope = parseArtifactEnvelope<T>(raw);
  if (!envelope) {
    return { ok: false, reason: "invalid" };
  }
  if (envelope.id !== id || envelope.version !== version) {
    return { ok: false, reason: "version_mismatch" };
  }
  return { ok: true, envelope };
}

/**
 * Read an artifact, returning the envelope or null.
 * Convenience for consumers that treat missing as "no data".
 */
export function readArtifactOrNull<T>(
  ctx: Pick<PluginContext, "sbtDataDir">,
  id: string,
  version: string
): ArtifactEnvelope<T> | null {
  const result = readArtifact<T>(ctx, id, version);
  return result.ok ? result.envelope : null;
}

// ---------------------------------------------------------------------------
// Artifact writer factory (fixes D5)
// ---------------------------------------------------------------------------

export interface CreateArtifactWriterOpts {
  id: string;
  version: string;
  producer: string;
  schemaRef?: string;
}

export interface WriteArtifactOpts {
  inputs?: Record<string, string>;
  meta?: Record<string, string>;
  generatedAt?: string;
}

/**
 * Create an artifact writer for a given artifact type.
 * Reduces boilerplate in plugins that produce versioned artifacts.
 */
export function createArtifactWriter<T>(opts: CreateArtifactWriterOpts) {
  const { id, version, producer, schemaRef } = opts;
  const defaultSchemaRef = schemaRef ?? `https://sbtools.dev/contracts/${id}/${version}`;

  return (
    ctx: Pick<PluginContext, "projectRoot" | "sbtDataDir">,
    data: T,
    writeOpts?: WriteArtifactOpts
  ): void => {
    const inputs = { projectRoot: ctx.projectRoot, ...writeOpts?.inputs };
    const meta = writeOpts?.meta;
    const generatedAt = writeOpts?.generatedAt ?? new Date().toISOString();

    const envelope: ArtifactEnvelope<T> = {
      id,
      version,
      producer,
      generatedAt,
      schemaRef: defaultSchemaRef,
      inputs,
      ...(meta && { meta }),
      data,
    };
    writeArtifact(ctx, envelope);
  };
}
