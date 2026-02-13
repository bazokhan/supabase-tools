/**
 * Docker container naming utilities.
 *
 * Derives the Docker Compose project prefix from project config or project root.
 * Used by core (for SBT_PREFIX env) and plugins (e.g. log tailing).
 */
import fs from "node:fs";
import path from "node:path";

/**
 * Sanitizes a raw project name into a valid Docker Compose project prefix.
 * Use when you already have the project name (e.g. from loaded config).
 */
export function sanitizeContainerPrefix(projectName: string): string {
  return (
    projectName
      .replace(/[^a-zA-Z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "sbt"
  );
}

/**
 * Derives the container prefix from a project root.
 * Reads supabase-tools.config.json for project.name, or falls back to the
 * directory basename. Returns a sanitized prefix suitable for Docker.
 */
export function deriveContainerPrefix(projectRoot: string): string {
  let projectName = path.basename(projectRoot);
  const configPath = path.join(projectRoot, "supabase-tools.config.json");
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (cfg?.project?.name) projectName = cfg.project.name;
    } catch {
      /* use fallback */
    }
  }
  return sanitizeContainerPrefix(projectName);
}
