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
} from "./plugin-api.js";

// CLI utilities
export { hasFlag, getArg, openFile } from "./cli-utils.js";

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
