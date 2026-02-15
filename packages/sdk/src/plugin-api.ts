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

  /** Called during `atlas-html` to contribute UI pieces to backend-atlas.html. */
  getAtlasUI?: () => PluginAtlasUI;

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
// Atlas UI contribution
// ---------------------------------------------------------------------------

/** UI pieces a plugin injects into backend-atlas.html. */
export interface PluginAtlasUI {
  /**
   * Map of kind → human label, e.g. { edge_function: "Edge Functions" }.
   * Merged into the kind-filter chip bar.
   */
  kindLabels: Record<string, string>;

  /** HTML for new `<section>` stubs appended after the built-in sections. */
  sectionHtml: string;

  /** JavaScript code defining card-renderer functions (injected into <script>). */
  cardRendererJs: string;

  /**
   * JavaScript code executed inside init(data) to wire up the new sections.
   * Has access to `data` (the full atlas JSON) and all renderer functions.
   */
  initJs: string;

  /** Additional CSS appended to the <style> block. */
  styles: string;
}
