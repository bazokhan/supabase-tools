/**
 * mermaid-generator.ts
 *
 * Generates a Mermaid flowchart from a DependencyGraph.
 * Output is a Markdown file with a ```mermaid code block.
 */
import fs from "node:fs";
import path from "node:path";
import { sanitizeIdentifier } from "@sbtools/sdk";
import type { DependencyGraph, GraphNode } from "./graph-builder.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sanitize a node id into a valid Mermaid identifier. */
function mermaidId(id: string): string {
  return sanitizeIdentifier(id);
}

/** Escape label text for Mermaid. */
function escapeLabel(text: string): string {
  return text.replace(/"/g, "#quot;").replace(/[[\]{}()]/g, "");
}

/** Group nodes by type. */
function groupByType(nodes: GraphNode[]): Map<string, GraphNode[]> {
  const groups = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const list = groups.get(node.type) ?? [];
    list.push(node);
    groups.set(node.type, list);
  }
  return groups;
}

const TYPE_LABELS: Record<string, string> = {
  table: "Tables",
  function: "Functions",
  trigger: "Triggers",
  policy: "Policies",
  view: "Views",
  materialized_view: "Materialized Views",
  enum: "Enums",
  type: "Types",
};

const TYPE_STYLES: Record<string, string> = {
  table: "fill:#dbeafe,stroke:#2563eb,color:#1e3a5f",
  function: "fill:#dcfce7,stroke:#16a34a,color:#14532d",
  trigger: "fill:#ffedd5,stroke:#ea580c,color:#7c2d12",
  policy: "fill:#f3e8ff,stroke:#9333ea,color:#581c87",
  view: "fill:#ccfbf1,stroke:#0d9488,color:#134e4a",
  materialized_view: "fill:#ccfbf1,stroke:#0d9488,color:#134e4a",
  enum: "fill:#fce7f3,stroke:#db2777,color:#831843",
  type: "fill:#fef3c7,stroke:#d97706,color:#78350f",
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateMermaid(graph: DependencyGraph): string {
  const lines: string[] = [];
  lines.push("# Dependency Graph");
  lines.push("");
  lines.push("```mermaid");
  lines.push("graph LR");
  lines.push("");

  const groups = groupByType(graph.nodes);

  // Emit subgraphs per node type
  for (const [type, nodes] of groups) {
    const label = TYPE_LABELS[type] ?? type;
    lines.push(`  subgraph ${label}`);
    for (const node of nodes) {
      const mid = mermaidId(node.id);
      const lbl = escapeLabel(node.label);
      // Use different shapes per type
      switch (type) {
        case "table":
          lines.push(`    ${mid}["${lbl}"]`);
          break;
        case "function":
          lines.push(`    ${mid}(["${lbl}"])`);
          break;
        case "enum":
          lines.push(`    ${mid}{{"${lbl}"}}`);
          break;
        case "trigger":
        case "policy":
          lines.push(`    ${mid}>"${lbl}"]`);
          break;
        default:
          lines.push(`    ${mid}["${lbl}"]`);
      }
    }
    lines.push("  end");
    lines.push("");
  }

  // Emit edges
  for (const edge of graph.edges) {
    const src = mermaidId(edge.source);
    const tgt = mermaidId(edge.target);
    const lbl = escapeLabel(edge.label);
    lines.push(`  ${src} -->|"${lbl}"| ${tgt}`);
  }

  lines.push("");

  // Emit style classes
  for (const [type, nodes] of groups) {
    const style = TYPE_STYLES[type];
    if (style) {
      const ids = nodes.map((n) => mermaidId(n.id));
      lines.push(`  classDef ${type}Style ${style}`);
      lines.push(`  class ${ids.join(",")} ${type}Style`);
    }
  }

  lines.push("```");
  lines.push("");

  return lines.join("\n");
}

export function writeMermaid(
  graph: DependencyGraph,
  outputPath: string,
): void {
  const content = generateMermaid(graph);
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, content, "utf-8");
}
