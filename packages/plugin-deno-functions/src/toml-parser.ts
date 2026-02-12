/**
 * Minimal TOML parser for supabase/config.toml.
 *
 * Only extracts [functions.<name>] sections and their key = value pairs.
 * This is intentionally simple — no external dependencies needed.
 */

export interface FunctionConfig {
  verify_jwt?: boolean;
  [key: string]: unknown;
}

/**
 * Parse a Supabase config.toml and return function-level settings.
 *
 * @param tomlContent - Raw TOML string.
 * @returns Map of function name → config (e.g. { "fetch-metadata": { verify_jwt: false } }).
 */
export function parseConfigToml(
  tomlContent: string
): Record<string, FunctionConfig> {
  const result: Record<string, FunctionConfig> = {};
  const lines = tomlContent.split("\n");

  let currentFunction: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip comments and blanks
    if (!line || line.startsWith("#")) continue;

    // Section header: [functions.some-name]
    const sectionMatch = line.match(
      /^\[functions\.([^\]]+)\]$/
    );
    if (sectionMatch) {
      currentFunction = sectionMatch[1].trim();
      result[currentFunction] = {};
      continue;
    }

    // Any other section header resets the current function context
    if (line.startsWith("[")) {
      currentFunction = null;
      continue;
    }

    // Key = value inside a function section
    if (currentFunction) {
      const kvMatch = line.match(/^(\w+)\s*=\s*(.+)$/);
      if (kvMatch) {
        const key = kvMatch[1];
        const rawValue = kvMatch[2].trim();
        result[currentFunction][key] = parseValue(rawValue);
      }
    }
  }

  return result;
}

/** Parse a TOML value literal (boolean, number, or string). */
function parseValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;

  // Quoted string
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }

  // Number
  const num = Number(raw);
  if (!Number.isNaN(num)) return num;

  // Fallback: return as string
  return raw;
}
