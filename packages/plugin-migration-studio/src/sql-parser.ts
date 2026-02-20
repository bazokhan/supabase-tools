/**
 * SQL parsing pipeline for Migration Studio.
 *
 * Two-layer analysis strategy (see plan §4.4):
 *
 * Layer 1 — Regex analyzer (existing sdk/src/sql-analyzer.ts)
 *   Fast classification, risk detection, operation counting.
 *   Zero dependencies, instant. Used for risk badges, lint rules.
 *
 * Layer 2 — Real Postgres parser (@supabase/pg-parser, WASM)
 *   Full AST extraction for intent graph construction.
 *   100% Postgres-compatible (real PG C parser compiled to WASM).
 *   Used here for structural understanding.
 *
 * Deparsing (pgsql-deparser / parser.deparse) is deferred:
 * raw SQL is recovered from source positions where available.
 */
import { PgParser } from "@supabase/pg-parser";
import { analyzeMigrationSql } from "@sbtools/sdk";
import type { MigrationSqlAnalysis } from "@sbtools/sdk";
import type {
  EntityNode,
  ColumnNode,
  PolicyNode,
  FunctionNode,
  ArgSpec,
  ViewNode,
  TriggerNode,
  InfraNode,
  OpaqueBlock,
} from "@sbtools/sdk";

// ---------------------------------------------------------------------------
// Supabase system schemas — excluded from intent graph management.
// Objects in these schemas appear in snapshots for reference but are read-only.
// ---------------------------------------------------------------------------
const SYSTEM_SCHEMAS = new Set([
  "auth",
  "storage",
  "realtime",
  "supabase_functions",
  "extensions",
  "pg_catalog",
  "information_schema",
]);

// ---------------------------------------------------------------------------
// Lazy singleton parser (WASM loads once on first parse call)
// ---------------------------------------------------------------------------

let _parser: PgParser | null = null;

/**
 * Returns the singleton PgParser instance.
 * The WASM binary is lazy-loaded on first use inside `parser.parse()`.
 */
export async function getSqlParser(): Promise<PgParser> {
  if (!_parser) {
    _parser = new PgParser();
  }
  return _parser;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single parsed SQL statement with its libpg_query AST node,
 * raw SQL text recovered from source positions, and byte offset.
 */
export interface ParsedStatement {
  /** libpg_query node type name (e.g., 'CreateStmt', 'AlterTableStmt'). */
  nodeType: string;
  /**
   * The AST node data (the value under the nodeType key in the raw stmt object).
   * Shape follows libpg_query JSON format; varies by Postgres version.
   */
  ast: Record<string, unknown>;
  /** Statement SQL extracted via stmt_location / stmt_len byte offsets. */
  rawSql: string;
  /** Byte offset of this statement in the original SQL string. */
  sourceIndex: number;
}

/** Combined output of the parsing pipeline for a single SQL file/string. */
export interface ParsedSql {
  statements: ParsedStatement[];
  opaqueBlocks: OpaqueBlock[];
  /** Risk metadata from the regex analyzer (Layer 1). Always present. */
  riskMeta: MigrationSqlAnalysis;
}

/** Extracted intent nodes from a set of parsed statements. */
export interface ExtractedNodes {
  entities: Partial<EntityNode>[];
  policies: Partial<PolicyNode>[];
  functions: Partial<FunctionNode>[];
  views: Partial<ViewNode>[];
  triggers: Partial<TriggerNode>[];
  infrastructure: Partial<InfraNode>[];
  /** Statements whose node types the intent graph cannot yet model. */
  opaqueBlocks: OpaqueBlock[];
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Parse an SQL migration string through both analysis layers.
 *
 * @param sql      Full SQL text to parse.
 * @param filename Optional filename for opaque block source spans.
 * @returns        ParsedSql with statements, opaque blocks, and risk metadata.
 */
export async function parseMigrationSql(
  sql: string,
  filename?: string
): Promise<ParsedSql> {
  // Layer 1: fast regex analysis (always runs, even if Layer 2 fails)
  const riskMeta = analyzeMigrationSql(sql);

  // Layer 2: real PG AST parsing
  const parser = await getSqlParser();
  let rawStmts: RawStmtEntry[];

  try {
    const result = await parser.parse(sql);
    if (result.error) {
      return _parseFailResult(sql, filename, riskMeta);
    }
    // tree.stmts is the array of statement wrappers from libpg_query
    rawStmts = ((result.tree as ParseTreeShape | undefined)?.stmts as RawStmtEntry[] | undefined) ?? [];
  } catch {
    return _parseFailResult(sql, filename, riskMeta);
  }

  const statements: ParsedStatement[] = [];
  const opaqueBlocks: OpaqueBlock[] = [];

  for (const entry of rawStmts) {
    const stmtNode = entry.stmt as Record<string, unknown> | undefined;
    if (!stmtNode) continue;

    const nodeKeys = Object.keys(stmtNode);
    if (nodeKeys.length === 0) continue;

    const nodeType = nodeKeys[0];
    const ast = (stmtNode[nodeType] as Record<string, unknown> | undefined) ?? {};

    // Recover raw SQL from byte offsets when available
    const loc = typeof entry.stmt_location === "number" ? entry.stmt_location : 0;
    const len = typeof entry.stmt_len === "number" ? entry.stmt_len : 0;
    const rawSql =
      len > 0
        ? sql.slice(loc, loc + len).trim()
        : sql.trim(); // fallback: whole string for single-statement inputs

    statements.push({ nodeType, ast, rawSql, sourceIndex: loc });
  }

  return { statements, opaqueBlocks, riskMeta };
}

// ---------------------------------------------------------------------------
// AST walker: extract typed intent nodes from parsed statements
// ---------------------------------------------------------------------------

/**
 * Walk parsed statements and extract typed intent graph nodes.
 *
 * Node type dispatch:
 * - CreateStmt           → EntityNode (tables)
 * - AlterTableStmt       → tracked but not yet modeled (future: modify EntityNode)
 * - CreatePolicyStmt     → PolicyNode
 * - CreateFunctionStmt   → FunctionNode
 * - IndexStmt            → tracked (future: add to EntityNode.indexes)
 * - ViewStmt             → ViewNode
 * - CreateTrigStmt       → TriggerNode
 * - CreateExtensionStmt  → InfraNode
 * - Unrecognized         → OpaqueBlock with astAvailable: true
 */
export function extractSchemaNodes(statements: ParsedStatement[]): ExtractedNodes {
  const entities: Partial<EntityNode>[] = [];
  const policies: Partial<PolicyNode>[] = [];
  const functions: Partial<FunctionNode>[] = [];
  const views: Partial<ViewNode>[] = [];
  const triggers: Partial<TriggerNode>[] = [];
  const infrastructure: Partial<InfraNode>[] = [];
  const opaqueBlocks: OpaqueBlock[] = [];

  for (const stmt of statements) {
    switch (stmt.nodeType) {
      case "CreateStmt": {
        const node = _extractEntity(stmt.ast);
        if (node) entities.push(node);
        break;
      }
      case "CreatePolicyStmt": {
        const node = _extractPolicy(stmt.ast);
        if (node) policies.push(node);
        break;
      }
      case "CreateFunctionStmt": {
        const node = _extractFunction(stmt.ast);
        if (node) functions.push(node);
        break;
      }
      case "ViewStmt": {
        const node = _extractView(stmt.ast);
        if (node) views.push(node);
        break;
      }
      case "CreateTrigStmt": {
        const node = _extractTrigger(stmt.ast);
        if (node) triggers.push(node);
        break;
      }
      case "CreateExtensionStmt": {
        const node = _extractInfra(stmt.ast);
        if (node) infrastructure.push(node);
        break;
      }
      // These modify existing nodes — handled by higher-level tools (studio-intent-sync).
      case "AlterTableStmt":
      case "IndexStmt":
      case "GrantStmt":
      case "RevokeStmt":
      case "AlterPolicyStmt":
        break;
      default:
        // Parsed successfully by @supabase/pg-parser but intent graph has no node type.
        opaqueBlocks.push({
          id: `opaque:stmt:${stmt.sourceIndex}`,
          rawSql: stmt.rawSql,
          sourceSpan: { file: "", startLine: 0, endLine: 0 },
          touchedObjects: [],
          reason: "unrepresentable",
          astAvailable: true,
        });
    }
  }

  return { entities, policies, functions, views, triggers, infrastructure, opaqueBlocks };
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface RawStmtEntry {
  stmt: unknown;
  stmt_location?: number;
  stmt_len?: number;
}

interface ParseTreeShape {
  version?: number;
  stmts?: RawStmtEntry[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _parseFailResult(
  sql: string,
  filename: string | undefined,
  riskMeta: MigrationSqlAnalysis
): ParsedSql {
  const lineCount = sql.split("\n").length;
  return {
    statements: [],
    opaqueBlocks: [
      {
        id: `opaque:${filename ?? "unknown"}:0`,
        rawSql: sql,
        sourceSpan: { file: filename ?? "", startLine: 1, endLine: lineCount },
        touchedObjects: riskMeta.touchedObjectKeys,
        reason: "unrepresentable",
        astAvailable: false,
      },
    ],
    riskMeta,
  };
}

/**
 * Extract a string value from a libpg_query String node.
 * Handles both PG 17 format ({ String: { sval: "..." } })
 * and older format ({ String: { str: "..." } }).
 */
function _strVal(node: unknown): string | undefined {
  if (typeof node !== "object" || node === null) return undefined;
  const n = node as Record<string, unknown>;
  const strNode = n["String"] as Record<string, unknown> | undefined;
  if (!strNode) return undefined;
  const val = strNode["sval"] ?? strNode["str"];
  return typeof val === "string" ? val : undefined;
}

/**
 * Extract schema + name from a RangeVar (relation reference).
 * Used in CreateStmt, CreatePolicyStmt, CreateTrigStmt, etc.
 */
function _extractRelation(
  ast: Record<string, unknown>
): { schema: string; name: string } | null {
  const rel = ast["relation"] as Record<string, unknown> | undefined;
  if (!rel || typeof rel["relname"] !== "string") return null;
  // schemaname is "" (empty string) for unqualified names — treat as "public"
  const schema = (rel["schemaname"] as string | undefined) || "public";
  return { schema, name: rel["relname"] as string };
}

/**
 * Resolve a TypeName wrapper to a human-readable Postgres type string.
 * Input may be:
 *   { TypeName: { names: [...] } }  — as it appears in ColumnDef.typeName
 *   { names: [...] }                — already unwrapped
 */
function _extractTypeName(typeNameWrapper: unknown): string {
  if (typeof typeNameWrapper !== "object" || typeNameWrapper === null) return "unknown";
  const wrapper = typeNameWrapper as Record<string, unknown>;

  // Unwrap the outer TypeName key if present
  const inner =
    (wrapper["TypeName"] as Record<string, unknown> | undefined) ?? wrapper;
  const names = (inner["names"] as unknown[]) ?? [];

  const parts = names.map(_strVal).filter((s): s is string => !!s);
  if (parts.length === 0) return "unknown";

  // Strip pg_catalog prefix and map internal PG type names to user-friendly names
  if (parts[0] === "pg_catalog" && parts.length >= 2) {
    const PG_TYPE_MAP: Record<string, string> = {
      int2: "smallint",
      int4: "integer",
      int8: "bigint",
      float4: "real",
      float8: "double precision",
      bool: "boolean",
      bpchar: "char",
      varchar: "varchar",
      text: "text",
      bytea: "bytea",
      timestamp: "timestamp",
      timestamptz: "timestamptz",
      date: "date",
      time: "time",
      timetz: "timetz",
      interval: "interval",
      numeric: "numeric",
      uuid: "uuid",
      json: "json",
      jsonb: "jsonb",
      xml: "xml",
      name: "name",
      oid: "oid",
    };
    const raw = parts[1];
    return PG_TYPE_MAP[raw] ?? raw;
  }

  return parts.join(".");
}

// ---------------------------------------------------------------------------
// Node extractors
// ---------------------------------------------------------------------------

function _extractEntity(
  ast: Record<string, unknown>
): Partial<EntityNode> | null {
  const rel = _extractRelation(ast);
  if (!rel) return null;
  if (SYSTEM_SCHEMAS.has(rel.schema)) return null;

  const id = `${rel.schema}.${rel.name}`;
  const tableElts = (ast["tableElts"] as unknown[]) ?? [];
  const columns: Partial<ColumnNode>[] = [];

  for (const elt of tableElts) {
    if (typeof elt !== "object" || elt === null) continue;
    const eltNode = elt as Record<string, unknown>;
    const colDef = eltNode["ColumnDef"] as Record<string, unknown> | undefined;
    if (!colDef || typeof colDef["colname"] !== "string") continue;

    // Check NOT NULL constraint in the column's inline constraints list
    const colConstraints = (colDef["constraints"] as unknown[]) ?? [];
    const isNotNull = colConstraints.some((c) => {
      const con = (c as Record<string, unknown>)["Constraint"] as
        | Record<string, unknown>
        | undefined;
      if (!con) return false;
      const contype = con["contype"] as string | number | undefined;
      // CONSTR_NOTNULL is "n" in newer libpg_query or the integer 1 in older
      return contype === "CONSTR_NOTNULL" || contype === "n" || contype === 1;
    });

    const defaultExpr = colConstraints.find((c) => {
      const con = (c as Record<string, unknown>)["Constraint"] as
        | Record<string, unknown>
        | undefined;
      if (!con) return false;
      const contype = con["contype"] as string | number | undefined;
      return contype === "CONSTR_DEFAULT" || contype === "d" || contype === 2;
    });

    columns.push({
      name: colDef["colname"] as string,
      type: _extractTypeName(colDef["typeName"]),
      nullable: !isNotNull,
      default: defaultExpr ? "[expression]" : undefined,
      managedStatus: "managed",
      confidence: 0.9,
    });
  }

  return {
    id,
    schema: rel.schema,
    name: rel.name,
    managedStatus: "managed",
    confidence: 0.9,
    columns: columns as ColumnNode[],
    constraints: [],
    indexes: [],
  };
}

function _extractPolicy(
  ast: Record<string, unknown>
): Partial<PolicyNode> | null {
  const table = ast["table"] as Record<string, unknown> | undefined;
  if (!table || typeof table["relname"] !== "string") return null;

  // schemaname is "" (empty string) for unqualified names — treat as "public"
  const schema = (table["schemaname"] as string | undefined) || "public";
  if (SYSTEM_SCHEMAS.has(schema)) return null;

  const tableName = table["relname"] as string;
  const policyName = (ast["policy_name"] as string | undefined) ?? "";
  const entityId = `${schema}.${tableName}`;
  const id = `policy:${entityId}.${policyName}`;

  // cmd_name maps: 'r'=SELECT, 'a'=INSERT, 'w'=UPDATE, 'd'=DELETE, '*'=ALL
  // Some versions use the full word; normalise both.
  const CMD_MAP: Record<string, PolicyNode["command"]> = {
    r: "SELECT",
    a: "INSERT",
    w: "UPDATE",
    d: "DELETE",
    "*": "ALL",
    select: "SELECT",
    insert: "INSERT",
    update: "UPDATE",
    delete: "DELETE",
    all: "ALL",
  };
  const cmdRaw = ((ast["cmd_name"] as string | undefined) ?? "*").toLowerCase();
  const command = CMD_MAP[cmdRaw] ?? "ALL";

  const roles = ((ast["roles"] as unknown[]) ?? [])
    .map((r) => {
      const roleSpec = (r as Record<string, unknown>)["RoleSpec"] as
        | Record<string, unknown>
        | undefined;
      // Field is 'rolename' in pg-parser v0.1.x (some versions used 'rolname')
      return (
        (roleSpec?.["rolename"] as string | undefined) ??
        (roleSpec?.["rolname"] as string | undefined) ??
        ""
      );
    })
    .filter(Boolean);

  // permissive: true = PERMISSIVE (default), false = RESTRICTIVE
  const permissive = (ast["permissive"] as boolean | undefined) !== false;

  return {
    id,
    entity: entityId,
    name: policyName,
    command,
    roles,
    permissive,
    managedStatus: "managed",
    confidence: 0.85,
  };
}

function _extractFunction(
  ast: Record<string, unknown>
): Partial<FunctionNode> | null {
  const funcname = ast["funcname"] as unknown[] | undefined;
  if (!funcname) return null;

  const parts = funcname.map(_strVal).filter((s): s is string => !!s);
  const schema = parts.length > 1 ? parts[0] : "public";
  const name = parts.length > 1 ? parts[1] : parts[0];
  if (!name) return null;
  if (SYSTEM_SCHEMAS.has(schema)) return null;

  // Extract language, security, volatility from DefElem options
  const options = (ast["options"] as unknown[]) ?? [];
  let language: FunctionNode["language"] = "sql";
  let security: FunctionNode["security"] = "invoker";
  let volatility: FunctionNode["volatility"] = "volatile";
  let body: string | undefined;

  for (const opt of options) {
    const defElem = (opt as Record<string, unknown>)["DefElem"] as
      | Record<string, unknown>
      | undefined;
    if (!defElem) continue;

    const defName = defElem["defname"] as string | undefined;
    const arg = defElem["arg"];

    switch (defName) {
      case "language": {
        const lang = (_strVal(arg) ?? "").toLowerCase();
        if (lang === "sql" || lang === "plpgsql" || lang === "plv8") {
          language = lang as FunctionNode["language"];
        }
        break;
      }
      case "security": {
        // Security definer: arg is Integer { ival: 1 } in PG 17; may be Boolean in others
        const argNode = arg as Record<string, unknown> | null | undefined;
        const intNode = argNode?.["Integer"] as Record<string, unknown> | undefined;
        const ival = intNode?.["ival"] as number | undefined;
        if (ival === 1) {
          security = "definer";
        } else {
          // Some versions encode as a boolean-like value
          const boolNode = argNode?.["Boolean"] as Record<string, unknown> | undefined;
          if (boolNode?.["boolval"] === true) security = "definer";
        }
        break;
      }
      case "volatility": {
        const vol = (_strVal(arg) ?? "").toLowerCase();
        if (vol === "volatile" || vol === "stable" || vol === "immutable") {
          volatility = vol as FunctionNode["volatility"];
        }
        break;
      }
      case "as": {
        // Function body — extract from List/String node
        const argNode = arg as Record<string, unknown> | null | undefined;
        if (argNode) {
          // PG 17: arg is a List with one String item
          const list = argNode["List"] as Record<string, unknown> | undefined;
          const listItems = (list?.["items"] as unknown[]) ?? [];
          if (listItems.length > 0) {
            body = _strVal(listItems[0]) ?? undefined;
          } else {
            // Fallback: arg is directly a String node
            body = _strVal(argNode) ?? undefined;
          }
        }
        break;
      }
    }
  }

  // Extract parameters
  const parameters = (ast["parameters"] as unknown[]) ?? [];
  const args: ArgSpec[] = [];
  for (const p of parameters) {
    const param = (p as Record<string, unknown>)["FunctionParameter"] as
      | Record<string, unknown>
      | undefined;
    if (!param) continue;

    const argName = param["name"] as string | undefined;
    const argType = _extractTypeName(param["argType"]);

    // Parameter mode: libpg_query uses an enum number
    const modeNum = param["mode"] as number | undefined;
    const MODE_MAP: Record<number, ArgSpec["mode"]> = {
      105: "in",    // 'i' = PARAM_IN
      111: "out",   // 'o' = PARAM_OUT
      98: "inout",  // 'b' = PARAM_INOUT
      118: "variadic", // 'v' = PARAM_VARIADIC
    };
    const mode = (modeNum != null ? MODE_MAP[modeNum] : undefined) ?? "in";

    args.push({ ...(argName ? { name: argName } : {}), type: argType, mode });
  }

  // Return type
  const returnType = _extractTypeName(ast["returnType"]);

  const id = `${schema}.${name}(${args.map((a) => a.type).join(", ")})`;

  return {
    id,
    schema,
    name,
    args,
    returnType,
    language,
    security,
    volatility,
    body,
    managedStatus: "managed",
    confidence: 0.85,
  };
}

function _extractView(ast: Record<string, unknown>): Partial<ViewNode> | null {
  const view = ast["view"] as Record<string, unknown> | undefined;
  if (!view || typeof view["relname"] !== "string") return null;

  // schemaname is "" (empty string) for unqualified names — treat as "public"
  const schema = (view["schemaname"] as string | undefined) || "public";
  if (SYSTEM_SCHEMAS.has(schema)) return null;

  const name = view["relname"] as string;
  const id = `${schema}.${name}`;

  return {
    id,
    schema,
    name,
    materialized: false, // ViewStmt is always non-materialized; CreateTableAsStmt covers MATERIALIZED
    query: "", // Full query deparsing deferred (use parser.deparse() when integrating)
    columns: [],
    managedStatus: "managed",
    confidence: 0.8,
  };
}

function _extractTrigger(
  ast: Record<string, unknown>
): Partial<TriggerNode> | null {
  const triggerName = ast["trigname"] as string | undefined;
  if (!triggerName) return null;

  const rel = _extractRelation(ast);
  if (!rel) return null;
  if (SYSTEM_SCHEMAS.has(rel.schema)) return null;

  const entityId = `${rel.schema}.${rel.name}`;
  const id = `trigger:${entityId}.${triggerName}`;

  // Timing bitmask: BEFORE=2, AFTER=1, INSTEAD OF=64
  const timingNum = ast["timing"] as number | undefined;
  const TIMING_MAP: Record<number, TriggerNode["timing"]> = {
    2: "BEFORE",
    1: "AFTER",
    64: "INSTEAD OF",
  };
  const timing = (timingNum != null ? TIMING_MAP[timingNum] : undefined) ?? "AFTER";

  // Events bitmask: INSERT=4, DELETE=16, UPDATE=8, TRUNCATE=32
  const eventsNum = (ast["events"] as number | undefined) ?? 0;
  const events: TriggerNode["events"] = [];
  if (eventsNum & 4) events.push("INSERT");
  if (eventsNum & 8) events.push("UPDATE");
  if (eventsNum & 16) events.push("DELETE");
  if (eventsNum & 32) events.push("TRUNCATE");

  return {
    id,
    entity: entityId,
    name: triggerName,
    timing,
    events,
    forEach: ast["row"] === true ? "ROW" : "STATEMENT",
    function: "", // Resolved from funcname separately in studio-intent-sync
    managedStatus: "managed",
    confidence: 0.8,
  };
}

function _extractInfra(ast: Record<string, unknown>): Partial<InfraNode> | null {
  const name = ast["extname"] as string | undefined;
  if (!name) return null;

  return {
    id: `extension:${name}`,
    type: "extension",
    name,
    details: {},
    managedStatus: "managed",
  };
}
