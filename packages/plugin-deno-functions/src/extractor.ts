/**
 * Static analysis extractor for Supabase Edge Functions.
 *
 * Reads TypeScript source files from the functions directory and extracts
 * metadata via regex patterns — no TypeScript compiler needed.
 */
import fs from "node:fs";
import path from "node:path";
import { parseConfigToml } from "./toml-parser.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EdgeFunctionField {
  name: string;
  type: string;
  required?: boolean;
}

export interface EdgeFunctionItem {
  id: string;
  kind: "edge_function";
  name: string;
  description: string;
  endpoint: string;
  methods: string[];
  verify_jwt: boolean;
  auth_type: string;
  request_fields: EdgeFunctionField[];
  response_fields: EdgeFunctionField[];
  env_vars: string[];
  cors: boolean;
  external_apis: string[];
  db_tables: string[];
  storage_buckets: string[];
  source: string;
}

// ---------------------------------------------------------------------------
// Regex extractors
// ---------------------------------------------------------------------------

/** Extract HTTP methods checked via req.method comparisons. */
function extractMethods(source: string): string[] {
  const methods = new Set<string>();

  // Pattern: req.method === 'POST' / req.method === "GET" etc.
  const methodChecks = source.matchAll(/req\.method\s*===?\s*['"](\w+)['"]/g);
  for (const m of methodChecks) {
    methods.add(m[1].toUpperCase());
  }

  // If only OPTIONS is detected (CORS preflight), assume POST as the primary method
  if (methods.size === 0 || (methods.size === 1 && methods.has("OPTIONS"))) {
    methods.add("POST");
  }

  return Array.from(methods).sort();
}

/** Extract request body fields from destructuring of req.json(). */
function extractRequestFields(source: string): EdgeFunctionField[] {
  const fields: EdgeFunctionField[] = [];

  // Pattern: const { a, b, c } = await req.json()
  const destructureMatch = source.match(
    /const\s*\{([^}]+)\}\s*=\s*await\s+req\.json\(\)/
  );
  if (destructureMatch) {
    const names = destructureMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
    for (const raw of names) {
      // Handle default values: name = 'default'
      const name = raw.split("=")[0].split(":")[0].trim();
      if (name) {
        fields.push({ name, type: inferType(name, source), required: true });
      }
    }
  }

  return fields;
}

/** Infer a simple type for a field name by looking at how it's used in source. */
function inferType(fieldName: string, source: string): string {
  const lower = fieldName.toLowerCase();
  if (lower.includes("id") || lower === "paper_id") return "string (UUID)";
  if (lower.includes("path") || lower.includes("url")) return "string";
  if (lower === "type") return "string";
  if (lower === "value") return "string";
  if (lower.includes("count") || lower.includes("limit") || lower.includes("offset")) return "number";
  if (lower.includes("flag") || lower.includes("enabled") || lower.includes("is_")) return "boolean";
  return "string";
}

/** Extract response fields from JSON.stringify({...}) patterns in success responses. */
function extractResponseFields(source: string): EdgeFunctionField[] {
  const fields: EdgeFunctionField[] = [];
  const seen = new Set<string>();

  // Pattern: JSON.stringify({ key1, key2: expr, key3 })
  // Look for the success/main response (not error responses)
  const stringifyMatches = source.matchAll(/JSON\.stringify\(\s*\{([^}]+)\}\s*\)/g);
  for (const m of stringifyMatches) {
    const body = m[1];
    // Skip error responses
    if (body.trim().startsWith("error")) continue;

    const entries = body.split(",");
    for (const entry of entries) {
      const trimmed = entry.trim();
      if (!trimmed) continue;

      // Handle: key: value  or  just key (shorthand)
      const colonIdx = trimmed.indexOf(":");
      const name = colonIdx >= 0 ? trimmed.slice(0, colonIdx).trim() : trimmed.trim();
      // Skip spread operators
      if (name.startsWith("...")) continue;
      if (name && !seen.has(name)) {
        seen.add(name);
        fields.push({ name, type: inferResponseType(name) });
      }
    }
  }

  return fields;
}

/** Infer response field type from name. */
function inferResponseType(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "success") return "boolean";
  if (lower.includes("length") || lower.includes("count")) return "number";
  if (lower === "searchable") return "boolean";
  if (lower === "error" || lower === "message" || lower === "details") return "string";
  if (lower === "identifiers") return "object";
  if (lower === "data" || lower === "result") return "object";
  return "unknown";
}

/** Extract Deno.env.get('...') calls. */
function extractEnvVars(source: string): string[] {
  const vars = new Set<string>();
  const matches = source.matchAll(/Deno\.env\.get\(\s*['"]([^'"]+)['"]\s*\)/g);
  for (const m of matches) {
    vars.add(m[1]);
  }
  return Array.from(vars).sort();
}

/** Detect CORS headers pattern. */
function hasCors(source: string): boolean {
  return /corsHeaders/i.test(source) || /Access-Control-Allow/i.test(source);
}

/** Extract external API URLs from fetch() calls. */
function extractExternalApis(source: string): string[] {
  const apis = new Set<string>();

  // Pattern: fetch(`https://...`) or fetch('https://...')
  const fetchMatches = source.matchAll(/fetch\(\s*[`'"](https?:\/\/[^`'"{\s]+)/g);
  for (const m of fetchMatches) {
    // Get base URL (strip path params)
    try {
      const url = new URL(m[1]);
      apis.add(`${url.protocol}//${url.host}${url.pathname.split("/").slice(0, 3).join("/")}`);
    } catch {
      apis.add(m[1].split("?")[0]);
    }
  }

  // Pattern: fetch(`${baseUrl}/path`) — less useful but still capture template literals
  // Intentionally skip these as they're dynamic.

  return Array.from(apis).sort();
}

/** Extract supabase table references from .from('table') calls. */
function extractDbTables(source: string): string[] {
  const tables = new Set<string>();
  const matches = source.matchAll(/\.from\(\s*['"]([^'"]+)['"]\s*\)/g);
  for (const m of matches) {
    tables.add(m[1]);
  }
  return Array.from(tables).sort();
}

/** Extract storage bucket references from .from('bucket') in storage context. */
function extractStorageBuckets(source: string): string[] {
  const buckets = new Set<string>();
  const matches = source.matchAll(/\.storage\s*\.\s*from\(\s*['"]([^'"]+)['"]\s*\)/g);
  for (const m of matches) {
    buckets.add(m[1]);
  }
  return Array.from(buckets).sort();
}

/** Determine auth type from source code patterns. */
function detectAuthType(source: string, verifyJwt: boolean): string {
  if (source.includes("SUPABASE_SERVICE_ROLE_KEY")) return "service_role";
  if (verifyJwt) return "jwt";
  return "public";
}

/** Read optional metadata.json override next to index.ts. */
function readMetadataOverride(fnDir: string): Record<string, unknown> | null {
  const metaPath = path.join(fnDir, "metadata.json");
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf8"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ExtractorContext {
  functionsPath: string;
  configTomlPath?: string;
  baseUrl?: string;
}

/**
 * Scan the functions directory and extract metadata for every edge function.
 */
export function extractEdgeFunctions(ctx: ExtractorContext): EdgeFunctionItem[] {
  const functionsDir = ctx.functionsPath;
  if (!fs.existsSync(functionsDir)) {
    return [];
  }

  // Read config.toml for verify_jwt settings
  const tomlPath = ctx.configTomlPath;
  const tomlConfig = tomlPath && fs.existsSync(tomlPath)
    ? parseConfigToml(fs.readFileSync(tomlPath, "utf8"))
    : {};

  const baseUrl = ctx.baseUrl ?? "/functions/v1";

  const entries = fs.readdirSync(functionsDir, { withFileTypes: true });
  const items: EdgeFunctionItem[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // Skip hidden/internal directories
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;

    const fnDir = path.join(functionsDir, entry.name);
    const indexFile = path.join(fnDir, "index.ts");
    if (!fs.existsSync(indexFile)) continue;

    const source = fs.readFileSync(indexFile, "utf8");
    const name = entry.name;

    // Get verify_jwt from config.toml (default true per Supabase defaults)
    const verifyJwt = tomlConfig[name]?.verify_jwt ?? true;

    // Optional metadata override
    const meta = readMetadataOverride(fnDir);

    const methods = extractMethods(source);
    const authType = detectAuthType(source, verifyJwt);
    const requestFields = extractRequestFields(source);
    const responseFields = extractResponseFields(source);
    const envVars = extractEnvVars(source);
    const cors = hasCors(source);
    const externalApis = extractExternalApis(source);
    const dbTables = extractDbTables(source);
    const storageBuckets = extractStorageBuckets(source);

    items.push({
      id: `edge_function.${name}`,
      kind: "edge_function",
      name,
      description: (meta?.description as string) ?? `Edge function: ${name}`,
      endpoint: `${baseUrl}/${name}`,
      methods,
      verify_jwt: verifyJwt,
      auth_type: (meta?.auth as string) ?? authType,
      request_fields: (meta?.request_fields as EdgeFunctionField[]) ?? requestFields,
      response_fields: (meta?.response_fields as EdgeFunctionField[]) ?? responseFields,
      env_vars: envVars,
      cors,
      external_apis: externalApis,
      db_tables: dbTables,
      storage_buckets: storageBuckets,
      source,
    });
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}
