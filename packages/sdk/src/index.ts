/**
 * @sbtools/sdk — Plugin SDK for supabase-tools.
 *
 * Re-exports everything that plugins (and core) may need:
 * - Shared types (AtlasData, FunctionItem, etc.)
 * - Plugin contract interfaces (SbtPlugin, PluginContext, etc.)
 * - CLI argument helpers (hasFlag, getArg, openFile)
 * - Semantic CLI output (ui)
 * - Error classes (SbtError, ConfigError, etc.)
 * - Filesystem utilities (ensureDir, writeFileInDir, etc.)
 */

// Types
export type {
    SchemaFilter,
    SnapshotMeta,
    ArgInfo,
    BaseItem,
    FunctionItem,
    ViewItem,
    TriggerItem,
    PolicyItem,
    TypeItem,
    EnumItem,
    AtlasData,
    PolicyRow,
    SnapshotContext,
    TypeRow,
    EnumRow,
} from "./types.js";

// Plugin API
export type {
    SbtPlugin,
    SbtPluginCommand,
    PluginContext,
    ResolvedPaths,
    PluginAtlasData,
    PluginAtlasUI,
    ArtifactCapabilities,
} from "./plugin-api.js";

// Artifact helpers
export {
    writeArtifact,
    readArtifact,
    readArtifactOrNull,
    validateArtifactEnvelope,
    parseArtifactEnvelope,
    artifactDir,
    artifactLatestPath,
    createArtifactWriter,
} from "./artifacts.js";
export type {
    ArtifactEnvelope,
    ReadArtifactResult,
    CreateArtifactWriterOpts,
    WriteArtifactOpts,
} from "./artifacts.js";

// CLI utilities
export { hasFlag, getArg, openFile, withHelp } from "./cli-utils.js";

// UI
export { ui } from "./ui.js";

// Errors
export {
    SbtError,
    ConfigError,
    SnapshotError,
    DatabaseError,
    PluginError,
    handleError,
} from "./errors.js";
export type { SbtErrorCode } from "./errors.js";

// Filesystem utilities
export {
    ensureDir,
    writeFileInDir,
    readText,
    safeName,
    safeFileName,
    sanitizeSlug,
    sanitizeIdentifier,
} from "./fs-utils.js";

// Compose utilities
export { extractComposeKey, extractSupabaseKeys } from "./compose-utils.js";
export type { SupabaseKeys } from "./compose-utils.js";

// Container utilities
export {
  sanitizeContainerPrefix,
  deriveContainerPrefix,
} from "./container-utils.js";

// SQL analyzer (shared by migration-audit and migration-studio)
export { analyzeMigrationSql } from "./sql-analyzer.js";
export type { OperationKind, ParsedOperation, MigrationSqlAnalysis } from "./sql-analyzer.js";

// DB utilities (optional: plugins need pg installed)
export {
  resolveDbUrl,
  createPgClient,
  testConnection,
  disconnectClient,
} from "./db-utils.js";

// Migration scanner
export {
  scanMigrationFiles,
  parseTimestampPrefix,
} from "./migration-scanner.js";
export type { MigrationFileInfo } from "./migration-scanner.js";

// Package meta
export { loadPackageVersion } from "./package-meta.js";

// Plugin config
export {
  getConfigString,
  getConfigNumber,
  getConfigStringArray,
  resolveConfigPath,
} from "./plugin-config.js";

// Constants
export { COMPOSE_DB_FILE, COMPOSE_API_DOCS_FILE } from "./constants.js";

// Templates
export { snapshotFileHeader } from "./templates.js";

// Atlas UI builder
export { buildAtlasUI } from "./atlas-ui.js";
export type {
  AtlasSectionDef,
  AtlasCardDef,
  AtlasBadgeDef,
  AtlasDetailDef,
  AtlasSummaryDef,
} from "./atlas-ui.js";
