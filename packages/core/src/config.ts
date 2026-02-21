/**
 * Merged configuration module for @sbtools/core.
 *
 * Combines config loading (paths, defaults, overrides) with Zod schema
 * validation (previously in config-schema.ts).  All config-related exports
 * are available from this single file.
 *
 * Imports error classes and UI from @sbtools/sdk so that @sbtools/core never reaches
 * into relative SDK internals.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ConfigError, ui } from "@sbtools/sdk";


const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Zod schemas (exported for testing)
// ---------------------------------------------------------------------------

/** Schema for a single plugin entry in supabase-tools.config.json. */
export const pluginEntrySchema = z.object({
  /** Path to the plugin folder, relative to project root. */
  path: z.string().min(1, "Plugin path must be a non-empty string"),
  /** Set to false to disable without removing the entry. Default true. */
  enabled: z.boolean().optional(),
  /** Arbitrary config passed to the plugin as pluginConfig. */
  config: z.record(z.unknown()).optional(),
});

export const pathsSchema = z.object({
  migrations: z.string().min(1).optional(),
  snapshot: z.string().min(1).optional(),
  docsOutput: z.string().min(1).optional(),
  functions: z.string().min(1).optional(),
}).strict("Unknown key in paths. Plugin-specific paths (erdOutput, typesOutput, tests) belong in plugins[].config.");

export const dbSchema = z.object({
  url: z.string().url("db.url must be a valid URL").optional(),
  container: z.string().min(1).optional(),
});

export const apiSchema = z.object({
  url: z.string().url("api.url must be a valid URL").optional(),
  studioUrl: z.string().url("api.studioUrl must be a valid URL").optional(),
  inbucketUrl: z.string().url("api.inbucketUrl must be a valid URL").optional(),
});

export const projectSchema = z.object({
  name: z.string().min(1, "project.name must be a non-empty string").optional(),
});

/** Full config-file schema. All fields optional -- defaults are merged below. */
export const configFileSchema = z
  .object({
    paths: pathsSchema.optional(),
    db: dbSchema.optional(),
    api: apiSchema.optional(),
    project: projectSchema.optional(),
    plugins: z.array(pluginEntrySchema).optional(),
  })
  .strict("Unknown top-level key in supabase-tools.config.json");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The TypeScript type inferred from the Zod schema. */
export type ConfigFile = z.infer<typeof configFileSchema>;

/** A single plugin entry in supabase-tools.config.json. */
export interface PluginEntry {
  /** Path to the plugin folder, relative to project root. */
  path: string;
  /** Set to false to disable without removing the entry. Default true. */
  enabled?: boolean;
  /** Arbitrary config passed to the plugin as pluginConfig. */
  config?: Record<string, unknown>;
}

export interface SupabaseToolsConfig {
  projectRoot: string;
  /** Core package root (where docker files live). */
  toolsDir: string;
  /** Project-local runtime data (.env, openapi-spec, schemaspy-out). */
  sbtDataDir: string;
  paths: {
    migrations: string;
    snapshot: string;
    docsOutput: string;
    functions: string;
  };
  db: {
    url: string;
    container: string;
  };
  api: {
    url: string;
    studioUrl: string;
    inbucketUrl: string;
  };
  project: {
    name: string;
  };
  plugins: PluginEntry[];
}

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

export interface ConfigValidationError {
  /** Human-readable summary, one line per issue. */
  message: string;
  /** Structured list of individual issues. */
  issues: { path: string; message: string }[];
}

/**
 * Validate a parsed JSON object against the config schema.
 * Returns `{ success: true, data }` or `{ success: false, error }`.
 */
export function validateConfig(
  raw: unknown,
): { success: true; data: ConfigFile } | { success: false; error: ConfigValidationError } {
  const result = configFileSchema.safeParse(raw);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const issues = result.error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
    message: issue.message,
  }));

  const message = [
    "Invalid supabase-tools.config.json:",
    ...issues.map((i) => `  \u2022 ${i.path}: ${i.message}`),
  ].join("\n");

  return { success: false, error: { message, issues } };
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS: Omit<SupabaseToolsConfig, "projectRoot" | "toolsDir" | "sbtDataDir" | "plugins"> & { plugins: PluginEntry[] } = {
  paths: {
    migrations: "supabase/migrations",
    snapshot: ".sbt/snapshot",
    docsOutput: ".sbt/docs",
    functions: "supabase/functions",
  },
  db: {
    url: "postgresql://postgres:postgres@localhost:54322/postgres",
    container: "supabase-db",
  },
  api: {
    url: "http://localhost:54321",
    studioUrl: "http://localhost:54323",
    inbucketUrl: "http://localhost:54324",
  },
  project: {
    name: "supabase-project",
  },
  plugins: [],
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function detectProjectName(projectRoot: string): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"),
    );
    if (pkg.name) return pkg.name;
  } catch {
    // no package.json or parse error
  }
  return path.basename(projectRoot);
}

function loadOverrides(projectRoot: string): ConfigFile | null {
  const configPath = path.join(projectRoot, "supabase-tools.config.json");
  if (!fs.existsSync(configPath)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    throw new ConfigError(
      `Could not parse ${configPath}: ${(err as Error).message}`,
      { cause: err },
    );
  }

  const result = validateConfig(raw);
  if (!result.success) {
    throw new ConfigError(result.error.message);
  }

  return result.data;
}

// ---------------------------------------------------------------------------
// Build the config object
// ---------------------------------------------------------------------------

function findProjectRoot(): string {
  // Walk up from cwd looking for supabase-tools.config.json (handles symlinked packages)
  let dir = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, "supabase-tools.config.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  // Fallback: assume cwd is the project root
  return process.cwd();
}

function buildConfig(): SupabaseToolsConfig {
  // toolsDir = core package root (where docker/, docker-compose.*.yml live)
  const toolsDir = path.resolve(__dirname, "..");
  // projectRoot = consumer project, found by walking up from cwd
  const projectRoot = findProjectRoot();
  const sbtDataDir = path.join(projectRoot, ".sbt");

  const overrides = loadOverrides(projectRoot);
  const projectName =
    overrides?.project?.name ?? detectProjectName(projectRoot);

  return {
    projectRoot,
    toolsDir,
    sbtDataDir,
    paths: { ...DEFAULTS.paths, ...overrides?.paths },
    db: { ...DEFAULTS.db, ...overrides?.db },
    api: { ...DEFAULTS.api, ...overrides?.api },
    project: { name: projectName },
    plugins: overrides?.plugins ?? DEFAULTS.plugins,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Resolved configuration. Import this from any script. */
export const config = buildConfig();

/** Resolve a config-relative path to an absolute path from project root. */
export function resolve(relPath: string): string {
  return path.resolve(config.projectRoot, relPath);
}
