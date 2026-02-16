/**
 * Regex-based migration SQL analyzer.
 * Classifies DDL operations, extracts touched objects, and detects risk indicators.
 * Shared across migration-audit and migration-studio; no plugin dependencies.
 */
export type OperationKind =
  | "create_table"
  | "alter_table"
  | "drop_table"
  | "create_index"
  | "alter_index"
  | "drop_index"
  | "create_function"
  | "drop_function"
  | "create_view"
  | "drop_view"
  | "create_trigger"
  | "drop_trigger"
  | "create_policy"
  | "drop_policy"
  | "alter_policy"
  | "create_extension"
  | "alter_extension"
  | "create_type"
  | "alter_type"
  | "drop_type"
  | "create_enum"
  | "alter_enum"
  | "constraint"
  | "grant"
  | "revoke"
  | "other";

export interface ParsedOperation {
  kind: OperationKind;
  objectKey: string;
  schema?: string;
  name?: string;
  rawMatch?: string;
}

export interface MigrationSqlAnalysis {
  operations: ParsedOperation[];
  touchedObjectKeys: string[];
  riskFlags: {
    hasTransaction: boolean;
    hasDestructive: boolean;
    hasIfExists: boolean;
    hasIfNotExists: boolean;
    hasTruncate: boolean;
    hasDrop: boolean;
  };
  confidence: "high" | "medium" | "low";
}

function normalizeIdent(s: string): string {
  return s?.trim().replace(/^["']|["']$/g, "") ?? "";
}

function objectKey(schema: string, name: string): string {
  const s = normalizeIdent(schema || "public");
  const n = normalizeIdent(name);
  return s ? `${s}.${n}` : n;
}

const RE_LINE_COMMENT = /--[^\n]*/g;
/** Block comment: avoids ReDoS by not using [\s\S]*? (linear-time match). */
const RE_BLOCK_COMMENT = /\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g;

function stripComments(sql: string): string {
  return sql.replace(RE_LINE_COMMENT, " ").replace(RE_BLOCK_COMMENT, " ").replace(/\s+/g, " ");
}

const PATTERNS: Array<{
  kind: OperationKind;
  re: RegExp;
  schemaGroup?: number;
  nameGroup?: number;
  keyFn?: (m: RegExpMatchArray) => string;
}> = [
  { kind: "create_table", re: /CREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)/i, schemaGroup: 1, nameGroup: 2 },
  { kind: "alter_table", re: /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)/i, schemaGroup: 1, nameGroup: 2 },
  { kind: "drop_table", re: /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)/i, schemaGroup: 1, nameGroup: 2 },
  { kind: "create_index", re: /CREATE\s+(?:UNIQUE\s+)?(?:CONCURRENTLY\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)\s+ON/i, schemaGroup: 1, nameGroup: 2 },
  { kind: "drop_index", re: /DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?(?:CONCURRENTLY\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)/i, schemaGroup: 1, nameGroup: 2 },
  { kind: "create_function", re: /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)\s*\(/i, schemaGroup: 1, nameGroup: 2, keyFn: (m) => { const s = m[1] ?? "public"; const n = m[2] ?? ""; const full = m[0] ?? ""; const args = full.match(/\(([^)]*)\)/)?.[1]?.trim().slice(0, 80) ?? ""; return `${normalizeIdent(s)}.${normalizeIdent(n)}(${args})`; } },
  { kind: "drop_function", re: /DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)\s*\([^)]*\)/i, schemaGroup: 1, nameGroup: 2, keyFn: (m) => { const s = m[1] ?? "public"; const n = m[2] ?? ""; const full = m[0] ?? ""; const args = full.match(/\(([^)]*)\)/)?.[1]?.trim().slice(0, 80) ?? ""; return `${normalizeIdent(s)}.${normalizeIdent(n)}(${args})`; } },
  { kind: "create_view", re: /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)/i, schemaGroup: 1, nameGroup: 2 },
  { kind: "drop_view", re: /DROP\s+(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+EXISTS\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)/i, schemaGroup: 1, nameGroup: 2 },
  { kind: "create_trigger", re: /CREATE\s+TRIGGER\s+([a-z_][a-z0-9_]*)\s+ON\s+(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)/i, keyFn: (m) => `trigger:${normalizeIdent(m[2] || "public")}.${normalizeIdent(m[3] || "")}.${normalizeIdent(m[1] || "")}` },
  { kind: "drop_trigger", re: /DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s+ON\s+(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)/i, keyFn: (m) => `trigger:${normalizeIdent(m[2] || "public")}.${normalizeIdent(m[3] || "")}.${normalizeIdent(m[1] || "")}` },
  { kind: "create_policy", re: /CREATE\s+POLICY\s+([a-z_][a-z0-9_]*)\s+ON\s+(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)/i, keyFn: (m) => `policy:${normalizeIdent(m[2] || "public")}.${normalizeIdent(m[3] || "")}.${normalizeIdent(m[1] || "")}` },
  { kind: "drop_policy", re: /DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s+ON\s+(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)/i, keyFn: (m) => `policy:${normalizeIdent(m[2] || "public")}.${normalizeIdent(m[3] || "")}.${normalizeIdent(m[1] || "")}` },
  { kind: "create_extension", re: /CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/i, keyFn: (m) => `extension:${normalizeIdent(m[1] || "")}` },
  { kind: "create_type", re: /CREATE\s+TYPE\s+(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)/i, schemaGroup: 1, nameGroup: 2 },
  { kind: "create_enum", re: /CREATE\s+TYPE\s+(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)\s+AS\s+ENUM/i, schemaGroup: 1, nameGroup: 2 },
  { kind: "drop_type", re: /DROP\s+TYPE\s+(?:IF\s+EXISTS\s+)?(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-z_][a-z0-9_]*)/i, schemaGroup: 1, nameGroup: 2 },
];

const DESTRUCTIVE_KINDS = new Set<OperationKind>(["drop_table", "drop_index", "drop_function", "drop_view", "drop_trigger", "drop_policy", "drop_type"]);

export function analyzeMigrationSql(sql: string): MigrationSqlAnalysis {
  const stripped = stripComments(sql);
  const operations: ParsedOperation[] = [];
  const seenKeys = new Set<string>();

  for (const { kind, re, schemaGroup, nameGroup, keyFn } of PATTERNS) {
    const regex = new RegExp(re.source, re.flags + "g");
    let m: RegExpMatchArray | null;
    while ((m = regex.exec(stripped)) !== null) {
      const objKey = keyFn ? keyFn(m) : objectKey(m[schemaGroup ?? 0] ?? "public", m[nameGroup ?? 0] ?? "");
      if (objKey && !seenKeys.has(objKey)) {
        seenKeys.add(objKey);
        operations.push({ kind, objectKey: objKey, schema: schemaGroup ? (m[schemaGroup] ?? undefined) : undefined, name: nameGroup ? (m[nameGroup] ?? undefined) : undefined, rawMatch: m[0]?.slice(0, 100) });
      }
    }
  }

  const riskFlags = {
    hasTransaction: /\bBEGIN\b|\bCOMMIT\b|\bROLLBACK\b|START\s+TRANSACTION/i.test(stripped),
    hasDestructive: operations.some((op) => DESTRUCTIVE_KINDS.has(op.kind)),
    hasIfExists: /\bIF\s+EXISTS\b/i.test(stripped),
    hasIfNotExists: /\bIF\s+NOT\s+EXISTS\b/i.test(stripped),
    hasTruncate: /\bTRUNCATE\b/i.test(stripped),
    hasDrop: /\bDROP\s+(?:TABLE|INDEX|FUNCTION|VIEW|TRIGGER|POLICY|TYPE)\b/i.test(stripped),
  };

  let confidence: "high" | "medium" | "low" = "low";
  if (stripped.trim().length === 0) confidence = "high";
  else if (operations.length > 0 && stripped.length < 50_000) confidence = "high";
  else if (operations.length > 0) confidence = "medium";

  return { operations, touchedObjectKeys: Array.from(seenKeys), riskFlags, confidence };
}
