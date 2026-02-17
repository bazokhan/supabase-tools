/**
 * Plugin contract for supabase-tools.
 *
 * This file exports **only TypeScript interfaces** — zero runtime code.
 * A plugin folder can optionally import these types for type-checking,
 * but they are erased at runtime so there is no runtime dependency
 * between the main package and any plugin.
 *
 * A plugin's index.ts must default-export an object matching SbtPlugin.
 */

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

/** Artifact capability declaration for a plugin. */
export interface ArtifactCapabilities {
  /** Artifact IDs this plugin produces. */
  produces?: string[];
  /** Artifact IDs this plugin consumes. */
  consumes?: string[];
}

/** Shape that every plugin's index.ts must default-export. */
export interface SbtPlugin {
  /** Unique plugin name (e.g. "@sbtools/plugin-deno-functions"). */
  name: string;

  /** Semver version string. Must match package.json version for artifact provenance. */
  version: string;

  /** Artifact IDs this plugin produces and consumes. Enables tooling to validate artifact availability. */
  artifactCapabilities?: ArtifactCapabilities;

  /** CLI commands this plugin adds to `sbt`. */
  commands?: SbtPluginCommand[];

  /** Called during `generate-pages` to contribute data to backend-atlas-data.json. */
  getAtlasData?: (ctx: PluginContext) => Promise<PluginAtlasData>;

  /**
   * Called during `sbt dashboard` to contribute declarative dashboard sections.
   * Returns JSON-serializable config — no JS strings.
   */
  getDashboardView?: () => DashboardView;

  /** Called during `status` to add extra info lines. */
  getStatusLines?: (ctx: PluginContext) => Promise<string[]>;

  /**
   * Called during `docs` to contribute paths to the combined OpenAPI spec.
   * Return a partial OpenAPI 3.0 object with `paths`, `components`, and
   * optionally `tags`. The main package deep-merges it into the PostgREST spec
   * so that Swagger UI and ReDoc show everything in one place.
   */
  getOpenApiSpec?: (ctx: PluginContext) => Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/** A single CLI command contributed by a plugin. */
export interface SbtPluginCommand {
  /** Command name typed after `sbt`, e.g. "edge-functions". */
  name: string;

  /** One-line description shown in `sbt help`. */
  description: string;

  /** Execute the command. */
  run: (args: string[], ctx: PluginContext) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context passed to plugin hooks
// ---------------------------------------------------------------------------

/** Shared config paths resolved to absolute paths. */
export interface ResolvedPaths {
  migrations: string;
  snapshot: string;
  docsOutput: string;
  functions: string;
}

/** Read-only context the main package passes to every plugin hook. */
export interface PluginContext {
  /** Absolute path to the project root. */
  projectRoot: string;

  /** Absolute path to the core package (docker files). */
  toolsDir: string;

  /** Project-local runtime data dir (.sbt/). */
  sbtDataDir: string;

  /** Absolute path to artifact storage (.sbt/artifacts/). Use SDK readArtifact/writeArtifact for access. */
  artifactsDir: string;

  /** The `config` block from the plugin entry in supabase-tools.config.json. */
  pluginConfig: Record<string, unknown>;

  /** Supabase API URL, e.g. "http://localhost:54321". */
  apiUrl: string;

  /** Shared config paths resolved to absolute paths. */
  paths: ResolvedPaths;

  /** All other loaded plugins — available for cross-plugin collaboration. */
  siblingPlugins?: SbtPlugin[];
}

// ---------------------------------------------------------------------------
// Atlas data contribution
// ---------------------------------------------------------------------------

/** Data a plugin adds to backend-atlas-data.json. */
export interface PluginAtlasData {
  /**
   * New category arrays to merge into AtlasData.categories.
   * Keys must not collide with built-in categories
   * (functions, views, materialized_views, triggers, policies, types, enums).
   */
  categories: Record<string, unknown[]>;

  /** Extra stat cards to show in the hero section. */
  stats: { label: string; value: number }[];
}

// ---------------------------------------------------------------------------
// Dashboard contribution (JSON-serializable, zero JS strings)
// ---------------------------------------------------------------------------

/** Tone for stat/card coloring. */
export type DashboardTone = "default" | "good" | "warn" | "bad" | "accent";

/** Stat definition for summary display. */
export interface DashboardStatDef {
  /** Human-readable label. */
  label: string;
  /** Dot-path into data (e.g. "total", "summary.applied"). */
  field: string;
  tone?: DashboardTone;
}

/** Field format for display. */
export type DashboardFieldFormat = "text" | "code" | "date" | "bytes" | "ms" | "number";

/** Card detail row definition. */
export interface DashboardDetailDef {
  label: string;
  field: string;
  format?: DashboardFieldFormat;
}

/** Badge definition for card header. */
export interface DashboardBadgeDef {
  /** Dot-path to value (e.g. "status", "label"). */
  field: string;
  /** Optional map of value → tone for coloring. */
  toneMap?: Record<string, DashboardTone>;
}

/** Card layout definition. */
export interface DashboardCardDef {
  titleField: string;
  subtitleField?: string;
  searchFields: string[];
  badges?: DashboardBadgeDef[];
  details?: DashboardDetailDef[];
}

/** Table column definition. */
export interface DashboardTableColumnDef {
  header: string;
  field: string;
  format?: DashboardFieldFormat;
}

/** Table layout definition. */
export interface DashboardTableDef {
  columns: DashboardTableColumnDef[];
}

/** Section layout type. */
export type DashboardSectionLayout = "cards" | "table" | "summary-only";

/** Declarative dashboard section (JSON-serializable). */
export interface DashboardSectionDef {
  id: string;
  title: string;
  description: string;
  /** Key in atlas-data categories. */
  dataKey: string;
  /**
   * Optional dot-path for the primary key (e.g. "id", "schema.name").
   * Used for detail lookup and search index. Falls back to heuristics when unset.
   */
  primaryKeyField?: string;
  /**
   * Optional dot-path to extract items from the category value.
   * e.g. "0.edges" when category is [{ edges: [...] }].
   */
  itemsPath?: string;
  /**
   * When category is an array, skip this many elements from the start (e.g. 1 to skip summary).
   */
  itemsStartIndex?: number;
  layout: DashboardSectionLayout;
  stats?: DashboardStatDef[];
  card?: DashboardCardDef;
  table?: DashboardTableDef;
  link?: { label: string; href: string };
}

/** Dashboard view contribution from a plugin. */
export interface DashboardView {
  sections: DashboardSectionDef[];
}
