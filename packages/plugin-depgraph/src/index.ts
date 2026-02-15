/**
 * @sbt/plugin-depgraph
 *
 * Plugin for supabase-tools that visualizes all backend dependency
 * relationships (tables, functions, triggers, policies, views, enums,
 * types, FK constraints) as both an interactive HTML graph and Mermaid
 * diagrams.
 *
 * Activated by adding an entry in supabase-tools.config.json:
 *
 *   "plugins": [{
 *     "path": "node_modules/@sbt/plugin-depgraph",
 *     "config": {}
 *   }]
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";
import { hasFlag, openFile, SbtError } from "@sbtools/sdk";
import { buildGraph } from "./graph-builder.js";
import { writeDepgraphArtifact } from "./artifact.js";

const require = createRequire(import.meta.url);
const PLUGIN_VERSION: string = (require("../package.json") as { version: string }).version;
import { generateMermaid, writeMermaid } from "./mermaid-generator.js";
import { generateHtml, writeHtml } from "./html-generator.js";
import { depgraphSectionHtml } from "./atlas/sections.js";
import { depgraphCardRendererJs } from "./atlas/cards.js";
import { depgraphStyles } from "./atlas/styles.js";

// ---------------------------------------------------------------------------
// Resolved paths
// ---------------------------------------------------------------------------

export function resolvePaths(ctx: PluginContext) {
  const docsDir = ctx.paths.docsOutput;
  const atlasDataPath = path.join(docsDir, "backend-atlas-data.json");
  const snapshotDir = ctx.paths.snapshot;
  const typesFilePath = (ctx.pluginConfig.typesFilePath as string) ??
    path.join(ctx.projectRoot, "src", "integrations", "supabase", "types.ts");
  const htmlOutput = path.join(docsDir, "dependency-graph.html");
  const mermaidOutput = path.join(docsDir, "dependency-graph.md");

  return { docsDir, atlasDataPath, snapshotDir, typesFilePath, htmlOutput, mermaidOutput };
}

// ---------------------------------------------------------------------------
// CLI: depgraph command
// ---------------------------------------------------------------------------

async function depgraphCommand(args: string[], ctx: PluginContext): Promise<void> {
  // ---- Help ----
  if (hasFlag(args, "--help", "-h")) {
    console.log(`
depgraph — Generate dependency graph visualizations

Usage:
  sbt depgraph              Generate both HTML and Mermaid graphs, open HTML in browser
  sbt depgraph --html       Generate only the HTML graph
  sbt depgraph --mermaid    Generate only the Mermaid graph
  sbt depgraph --json       Output the raw graph data as JSON

Options:
  --html       Generate only the interactive HTML graph
  --mermaid    Generate only the Mermaid flowchart
  --json       Output raw graph JSON to stdout
  --no-open    Skip opening the result in the browser
  -h, --help   Show this help

The plugin reads from docs/backend-atlas-data.json (produced by 'sbt generate-atlas')
and supabase/current/ snapshot files. No running database is required.
`);
    return;
  }

  const paths = resolvePaths(ctx);

  if (!fs.existsSync(paths.atlasDataPath)) {
    throw new SbtError("PREFLIGHT_FAILED", `Atlas data not found at ${paths.atlasDataPath}.`, {
      tips: ["Run `sbt generate-atlas` first to generate the atlas data."],
    });
  }

  const graph = buildGraph(paths.atlasDataPath, paths.snapshotDir, paths.typesFilePath);
  if (graph.nodes.length > 0) {
    writeDepgraphArtifact(ctx, graph, {
      atlasDataPath: paths.atlasDataPath,
      snapshotDir: paths.snapshotDir,
      pluginVersion: PLUGIN_VERSION,
    });
  }

  if (graph.nodes.length === 0) {
    console.error(
      "No nodes found. Ensure 'sbt generate-atlas' has been run first.",
    );
    return;
  }

  const onlyHtml = hasFlag(args, "--html");
  const onlyMermaid = hasFlag(args, "--mermaid");
  const onlyJson = hasFlag(args, "--json");
  const shouldOpen = !hasFlag(args, "--no-open");

  if (onlyJson) {
    console.log(JSON.stringify(graph, null, 2));
    return;
  }

  if (onlyHtml) {
    writeHtml(graph, paths.htmlOutput);
    console.log(`HTML graph written to ${paths.htmlOutput}`);
    if (shouldOpen) openFile(paths.htmlOutput);
    return;
  }

  if (onlyMermaid) {
    writeMermaid(graph, paths.mermaidOutput);
    console.log(`Mermaid graph written to ${paths.mermaidOutput}`);
    if (shouldOpen) openFile(paths.mermaidOutput);
    return;
  }

  // Default: generate both, open HTML
  writeHtml(graph, paths.htmlOutput);
  console.log(`HTML graph written to ${paths.htmlOutput}`);

  writeMermaid(graph, paths.mermaidOutput);
  console.log(`Mermaid graph written to ${paths.mermaidOutput}`);

  console.log(
    `\nGraph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`,
  );

  if (shouldOpen) openFile(paths.htmlOutput);
}

// ---------------------------------------------------------------------------
// Atlas data helpers
// ---------------------------------------------------------------------------

function getRelationshipCounts(
  edges: { label: string }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of edges) {
    counts[e.label] = (counts[e.label] || 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-depgraph",
  version: PLUGIN_VERSION,
  artifactCapabilities: {
    produces: ["depgraph.graph"],
    consumes: [],
  },

  commands: [
    {
      name: "depgraph",
      description:
        "Generate dependency graph visualizations (HTML + Mermaid)",
      run: depgraphCommand,
    },
  ],

  getAtlasData: async (ctx: PluginContext) => {
    const paths = resolvePaths(ctx);
    const graph = buildGraph(paths.atlasDataPath, paths.snapshotDir, paths.typesFilePath);
    // Artifact is written by command - skip here to avoid redundant writes

    const relationshipCounts = getRelationshipCounts(graph.edges);

    // Build a flat list of edge summaries for the Atlas card list
    const edgeSummaries = graph.edges.map((e) => {
      const srcNode = graph.nodes.find((n) => n.id === e.source);
      const tgtNode = graph.nodes.find((n) => n.id === e.target);
      return {
        source_id: e.source,
        target_id: e.target,
        source_label: srcNode?.label ?? e.source,
        target_label: tgtNode?.label ?? e.target,
        source_type: srcNode?.type ?? "unknown",
        target_type: tgtNode?.type ?? "unknown",
        label: e.label,
      };
    });

    return {
      categories: {
        dependency_graph: [
          {
            total_nodes: graph.nodes.length,
            total_edges: graph.edges.length,
            relationship_counts: relationshipCounts,
            edges: edgeSummaries,
          },
        ],
      },
      stats: [
        { label: "Graph Nodes", value: graph.nodes.length },
        { label: "Graph Edges", value: graph.edges.length },
      ],
    };
  },

  getAtlasUI: () => ({
    kindLabels: {
      dependency_graph: "Dependency Graph",
    },
    sectionHtml: depgraphSectionHtml(),
    cardRendererJs: depgraphCardRendererJs(),
    initJs: [
      "renderDepgraphSummary(data);",
      'renderSection("depgraph-rel-list", (data.categories.dependency_graph && data.categories.dependency_graph[0] && data.categories.dependency_graph[0].edges) || [], renderDepgraphRelCard, "relationships");',
    ].join("\n    "),
    styles: depgraphStyles(),
  }),

  getStatusLines: async (ctx: PluginContext) => {
    const paths = resolvePaths(ctx);
    const graph = buildGraph(paths.atlasDataPath, paths.snapshotDir, paths.typesFilePath);
    // Artifact is written by command - skip here to avoid redundant writes

    const lines: string[] = [];
    lines.push(
      `  Dependency Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`,
    );

    const counts = getRelationshipCounts(graph.edges);
    for (const [label, count] of Object.entries(counts)) {
      lines.push(`    ${label}: ${count}`);
    }

    return lines;
  },
};

export default plugin;
