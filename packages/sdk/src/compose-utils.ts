/**
 * Utilities for reading values from Docker Compose YAML files.
 */
import fs from "node:fs";

/** Regex patterns for Supabase keys in docker-compose. */
const ANON_KEY_PATTERNS = [
  /SUPABASE_ANON_KEY:\s*([^\s]+)/,
  /ANON_KEY:\s*([^\s]+)/,
];

const SERVICE_KEY_PATTERNS = [
  /SUPABASE_SERVICE_ROLE_KEY:\s*([^\s]+)/,
  /SUPABASE_SERVICE_KEY:\s*([^\s]+)/,
  /SERVICE_KEY:\s*([^\s]+)/,
];

function extractFirst(content: string, patterns: RegExp[]): string {
  for (const re of patterns) {
    const m = content.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

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
  return extractFirst(content, patterns);
}

export interface SupabaseKeys {
  anonKey: string;
  serviceKey: string;
}

/**
 * Extracts anon and service_role keys from a Supabase docker-compose file.
 * Reads the file once and returns both keys.
 *
 * @param composePath - Absolute path to docker-compose.db.yml (or similar)
 * @returns Object with anonKey and serviceKey (empty string if not found)
 */
export function extractSupabaseKeys(composePath: string): SupabaseKeys {
  let content: string;
  try {
    content = fs.readFileSync(composePath, "utf8");
  } catch {
    return { anonKey: "", serviceKey: "" };
  }
  return {
    anonKey: extractFirst(content, ANON_KEY_PATTERNS),
    serviceKey: extractFirst(content, SERVICE_KEY_PATTERNS),
  };
}
