/**
 * graph-builder.ts
 *
 * Parses the atlas data JSON and snapshot type files to build a dependency
 * graph of all backend objects: tables, functions, triggers, policies,
 * views, enums, and types.
 */
import fs from "node:fs";
import path from "node:path";
import { SbtError } from "@sbtools/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  schema: string;
  metadata: Record<string, string>;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Atlas data item shapes (duck-typed, no import from main package)
interface AtlasItem {
  id: string;
  kind: string;
  schema?: string;
  name: string;
  sql?: string;
}

interface TriggerItem extends AtlasItem {
  table: string;
  function_name: string;
  timing: string;
  events: string;
}

interface PolicyItem extends AtlasItem {
  table: string;
  permissive: string;
  command: string;
  using: string;
  with_check: string;
}

interface FunctionItem extends AtlasItem {
  signature: string;
  returns: string;
}

interface ViewItem extends AtlasItem {}

interface EnumItem extends AtlasItem {
  values: string[];
}

interface TypeItem extends AtlasItem {
  type_kind: string;
}

interface AtlasData {
  schemas: string[];
  categories: {
    functions: FunctionItem[];
    views: ViewItem[];
    materialized_views: ViewItem[];
    triggers: TriggerItem[];
    policies: PolicyItem[];
    types: TypeItem[];
    enums: EnumItem[];
    [key: string]: unknown[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nodeId(type: string, schema: string, name: string): string {
  return `${type}:${schema}.${name}`;
}

function addNode(
  nodes: Map<string, GraphNode>,
  type: string,
  schema: string,
  name: string,
  metadata: Record<string, string> = {},
): void {
  const id = nodeId(type, schema, name);
  if (!nodes.has(id)) {
    nodes.set(id, { id, type, label: name, schema, metadata });
  }
}

function addEdge(
  edges: GraphEdge[],
  source: string,
  target: string,
  label: string,
): void {
  edges.push({ source, target, label });
}

/** Extract table names referenced in SQL (FROM / JOIN / INTO / UPDATE / ON). */
function extractTableRefs(sql: string, schema: string): string[] {
  const tables: Set<string> = new Set();
  // Match FROM/JOIN/INTO/UPDATE/ON followed by optional schema prefix and table name
  const pattern =
    /(?:FROM|JOIN|INTO|UPDATE|ON)\s+(?:(?:public|"public")\.)?("?[a-z_][a-z0-9_]*"?)/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(sql)) !== null) {
    const tbl = m[1].replace(/"/g, "");
    // Skip common keywords that appear after ON (e.g. "EACH", "ROW")
    if (
      !["each", "row", "true", "false", "null", "public"].includes(
        tbl.toLowerCase(),
      )
    ) {
      tables.add(tbl);
    }
  }
  return [...tables];
}

/** Extract function calls from policy USING / WITH CHECK expressions. */
function extractFunctionCalls(expr: string): string[] {
  if (!expr || expr === "true" || expr === "false") return [];
  const fns: Set<string> = new Set();
  // Match function_name( patterns, excluding common SQL keywords
  const pattern = /([a-z_][a-z0-9_]*)\s*\(/gi;
  let m: RegExpExecArray | null;
  const keywords = new Set([
    "select",
    "where",
    "and",
    "or",
    "not",
    "in",
    "exists",
    "case",
    "when",
    "then",
    "else",
    "end",
    "cast",
    "coalesce",
    "nullif",
    "array",
  ]);
  while ((m = pattern.exec(expr)) !== null) {
    const fn = m[1].toLowerCase();
    if (!keywords.has(fn)) {
      fns.add(fn);
    }
  }
  return [...fns];
}

/**
 * Parse the Supabase-generated TypeScript types file to extract FK
 * relationships and enum usage for public-schema tables.
 */
function parseTypesFile(typesPath: string): {
  fks: { table: string; referencedTable: string; column: string }[];
  enumUsages: { table: string; enumName: string }[];
} {
  const fks: { table: string; referencedTable: string; column: string }[] = [];
  const enumUsages: { table: string; enumName: string }[] = [];

  if (!fs.existsSync(typesPath)) return { fks, enumUsages };

  const content = fs.readFileSync(typesPath, "utf-8");

  // We're inside the `public:` section — extract table blocks
  const publicMatch = content.match(
    /public:\s*\{[\s\S]*?Tables:\s*\{([\s\S]*?)\n    Views:/,
  );
  if (!publicMatch) return { fks, enumUsages };

  const tablesBlock = publicMatch[1];

  // Find each table name and its Relationships block
  const tablePattern =
    /(\w+):\s*\{\s*Row:\s*\{[\s\S]*?Relationships:\s*\[([\s\S]*?)\]\s*\}/g;
  let tm: RegExpExecArray | null;
  while ((tm = tablePattern.exec(tablesBlock)) !== null) {
    const tableName = tm[1];
    const relBlock = tm[2];

    // Extract FK entries
    const fkPattern =
      /foreignKeyName:\s*"[^"]+"\s*columns:\s*\["([^"]+)"\]\s*referencedRelation:\s*"([^"]+)"/g;
    let fkm: RegExpExecArray | null;
    while ((fkm = fkPattern.exec(relBlock)) !== null) {
      fks.push({
        table: tableName,
        referencedTable: fkm[2],
        column: fkm[1],
      });
    }

    // Detect enum usage in Row block
    const rowMatch = tm[0].match(/Row:\s*\{([\s\S]*?)\}/);
    if (rowMatch) {
      const enumPattern = /Database\["public"\]\["Enums"\]\["(\w+)"\]/g;
      let em: RegExpExecArray | null;
      while ((em = enumPattern.exec(rowMatch[1])) !== null) {
        enumUsages.push({ table: tableName, enumName: em[1] });
      }
    }
  }

  return { fks, enumUsages };
}

/**
 * Parse snapshot type SQL files for FK REFERENCES clauses.
 * These may contain CREATE TABLE or ALTER TABLE with REFERENCES.
 */
function parseSnapshotTypes(
  snapshotDir: string,
): { table: string; schema: string; referencedTable: string }[] {
  const results: {
    table: string;
    schema: string;
    referencedTable: string;
  }[] = [];
  const typesDir = path.join(snapshotDir, "types");

  if (!fs.existsSync(typesDir)) return results;

  const files = fs.readdirSync(typesDir).filter((f) => f.endsWith(".sql"));
  for (const file of files) {
    const sql = fs.readFileSync(path.join(typesDir, file), "utf-8");
    // Extract schema.table from filename (e.g. public.papers.sql)
    const parts = file.replace(".sql", "").split(".");
    if (parts.length < 2) continue;
    const schema = parts[0];
    const table = parts.slice(1).join(".");

    // Look for REFERENCES clauses
    const refPattern =
      /REFERENCES\s+(?:(?:public|"public")\.)?("?[a-z_][a-z0-9_]*"?)/gi;
    let rm: RegExpExecArray | null;
    while ((rm = refPattern.exec(sql)) !== null) {
      results.push({
        table,
        schema,
        referencedTable: rm[1].replace(/"/g, ""),
      });
    }

    // Look for enum type references (e.g. public.paper_status)
    // Already handled elsewhere
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildGraph(
  atlasDataPath: string,
  snapshotDir: string,
  typesFilePath?: string,
): DependencyGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  // Load atlas data
  if (!fs.existsSync(atlasDataPath)) {
    throw new SbtError("PREFLIGHT_FAILED", `Atlas data not found at ${atlasDataPath}.`, {
      tips: ["Run `sbt generate-atlas` first to generate the atlas data."],
    });
  }

  const atlas: AtlasData = JSON.parse(
    fs.readFileSync(atlasDataPath, "utf-8"),
  );
  const defaultSchema = atlas.schemas?.[0] ?? "public";

  // ------------------------------------------------------------------
  // 1. Build nodes from all categories
  // ------------------------------------------------------------------

  // Functions
  for (const fn of atlas.categories.functions ?? []) {
    const s = fn.schema ?? defaultSchema;
    addNode(nodes, "function", s, fn.name, {
      signature: (fn as FunctionItem).signature ?? "",
      returns: (fn as FunctionItem).returns ?? "",
    });
  }

  // Triggers
  for (const tr of atlas.categories.triggers ?? []) {
    const s = tr.schema ?? defaultSchema;
    const t = tr as TriggerItem;
    addNode(nodes, "trigger", s, t.name, {
      table: t.table,
      timing: t.timing,
      events: t.events,
    });
    // Ensure the table node exists
    addNode(nodes, "table", s, t.table);
  }

  // Policies
  for (const pol of atlas.categories.policies ?? []) {
    const s = pol.schema ?? defaultSchema;
    const p = pol as PolicyItem;
    addNode(nodes, "policy", s, p.name, {
      table: p.table,
      command: p.command,
      permissive: p.permissive,
    });
    // Ensure the table node exists
    addNode(nodes, "table", s, p.table);
  }

  // Views
  for (const v of atlas.categories.views ?? []) {
    const s = v.schema ?? defaultSchema;
    addNode(nodes, "view", s, v.name);
  }

  // Materialized views
  for (const mv of atlas.categories.materialized_views ?? []) {
    const s = mv.schema ?? defaultSchema;
    addNode(nodes, "materialized_view", s, mv.name);
  }

  // Enums
  for (const en of atlas.categories.enums ?? []) {
    const s = en.schema ?? defaultSchema;
    addNode(nodes, "enum", s, en.name, {
      values: (en as EnumItem).values?.join(", ") ?? "",
    });
  }

  // Types (composite)
  for (const tp of atlas.categories.types ?? []) {
    const s = tp.schema ?? defaultSchema;
    const t = tp as TypeItem;
    // Composite types with the same name as a table are table row types;
    // ensure the table node exists
    if (t.type_kind === "composite") {
      addNode(nodes, "table", s, t.name);
    } else {
      addNode(nodes, "type", s, t.name, { type_kind: t.type_kind });
    }
  }

  // ------------------------------------------------------------------
  // 2. Build edges
  // ------------------------------------------------------------------

  // 2a. trigger -> table ("fires on")
  for (const tr of atlas.categories.triggers ?? []) {
    const s = tr.schema ?? defaultSchema;
    const t = tr as TriggerItem;
    addEdge(
      edges,
      nodeId("trigger", s, t.name),
      nodeId("table", s, t.table),
      "fires on",
    );
  }

  // 2b. trigger -> function ("calls")
  for (const tr of atlas.categories.triggers ?? []) {
    const s = tr.schema ?? defaultSchema;
    const t = tr as TriggerItem;
    if (t.function_name) {
      const fnNodeId = nodeId("function", s, t.function_name);
      // Ensure function node exists
      addNode(nodes, "function", s, t.function_name);
      addEdge(edges, nodeId("trigger", s, t.name), fnNodeId, "calls");
    }
  }

  // 2c. policy -> table ("guards")
  for (const pol of atlas.categories.policies ?? []) {
    const s = pol.schema ?? defaultSchema;
    const p = pol as PolicyItem;
    addEdge(
      edges,
      nodeId("policy", s, p.name),
      nodeId("table", s, p.table),
      "guards",
    );
  }

  // 2d. function -> table ("references") — parse function SQL body
  for (const fn of atlas.categories.functions ?? []) {
    const s = fn.schema ?? defaultSchema;
    if (fn.sql) {
      const refs = extractTableRefs(fn.sql, s);
      for (const tbl of refs) {
        if (nodes.has(nodeId("table", s, tbl))) {
          addEdge(
            edges,
            nodeId("function", s, fn.name),
            nodeId("table", s, tbl),
            "references",
          );
        }
      }
    }
  }

  // 2e. view -> table ("reads from") — parse view SQL
  for (const v of atlas.categories.views ?? []) {
    const s = v.schema ?? defaultSchema;
    if (v.sql) {
      const refs = extractTableRefs(v.sql, s);
      for (const tbl of refs) {
        addNode(nodes, "table", s, tbl);
        addEdge(
          edges,
          nodeId("view", s, v.name),
          nodeId("table", s, tbl),
          "reads from",
        );
      }
    }
  }

  // Also for materialized views
  for (const mv of atlas.categories.materialized_views ?? []) {
    const s = mv.schema ?? defaultSchema;
    if (mv.sql) {
      const refs = extractTableRefs(mv.sql, s);
      for (const tbl of refs) {
        addNode(nodes, "table", s, tbl);
        addEdge(
          edges,
          nodeId("materialized_view", s, mv.name),
          nodeId("table", s, tbl),
          "reads from",
        );
      }
    }
  }

  // 2f. policy -> function ("calls in check") — parse USING / WITH CHECK
  for (const pol of atlas.categories.policies ?? []) {
    const s = pol.schema ?? defaultSchema;
    const p = pol as PolicyItem;
    const fns = new Set([
      ...extractFunctionCalls(p.using ?? ""),
      ...extractFunctionCalls(p.with_check ?? ""),
    ]);
    for (const fn of fns) {
      if (nodes.has(nodeId("function", s, fn))) {
        addEdge(
          edges,
          nodeId("policy", s, p.name),
          nodeId("function", s, fn),
          "calls in check",
        );
      }
    }
  }

  // ------------------------------------------------------------------
  // 3. FK and enum relationships from snapshot type SQL files
  // ------------------------------------------------------------------
  const snapshotFks = parseSnapshotTypes(snapshotDir);
  for (const fk of snapshotFks) {
    addNode(nodes, "table", fk.schema, fk.table);
    addNode(nodes, "table", fk.schema, fk.referencedTable);
    addEdge(
      edges,
      nodeId("table", fk.schema, fk.table),
      nodeId("table", fk.schema, fk.referencedTable),
      "FK to",
    );
  }

  // ------------------------------------------------------------------
  // 4. FK and enum relationships from TypeScript types file
  // ------------------------------------------------------------------
  const resolvedTypesPath =
    typesFilePath ??
    path.join(path.dirname(atlasDataPath), "..", "src", "integrations", "supabase", "types.ts");

  if (fs.existsSync(resolvedTypesPath)) {
    const { fks, enumUsages } = parseTypesFile(resolvedTypesPath);

    for (const fk of fks) {
      addNode(nodes, "table", defaultSchema, fk.table);
      addNode(nodes, "table", defaultSchema, fk.referencedTable);
      const src = nodeId("table", defaultSchema, fk.table);
      const tgt = nodeId("table", defaultSchema, fk.referencedTable);
      // Avoid duplicate FK edges
      if (!edges.some((e) => e.source === src && e.target === tgt && e.label === "FK to")) {
        addEdge(edges, src, tgt, "FK to");
      }
    }

    for (const eu of enumUsages) {
      addNode(nodes, "table", defaultSchema, eu.table);
      const enumNodeId = nodeId("enum", defaultSchema, eu.enumName);
      if (nodes.has(enumNodeId)) {
        const src = nodeId("table", defaultSchema, eu.table);
        if (!edges.some((e) => e.source === src && e.target === enumNodeId && e.label === "uses enum")) {
          addEdge(edges, src, enumNodeId, "uses enum");
        }
      }
    }
  }

  return { nodes: [...nodes.values()], edges };
}
