/**
 * Utilities for reading values from Docker Compose YAML files.
 */
import fs from "node:fs";

/**
 * Extracts the first matching value from a compose YAML file using regex patterns.
 * Each pattern should have a capturing group for the value (e.g. /KEY:\s*([^\s]+)/).
 *
 * @param composePath - Absolute path to the docker-compose.yml file
 * @param patterns - Array of regex patterns to try (first match wins)
 * @returns The extracted value or empty string if not found
 */
export function extractComposeKey(composePath: string, patterns: RegExp[]): string {
  let content: string;
  try {
    content = fs.readFileSync(composePath, "utf8");
  } catch {
    return "";
  }
  for (const re of patterns) {
    const m = content.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}
