/**
 * @sbtools/plugin-depgraph
 *
 * Plugin for supabase-tools that visualizes all backend dependency
 * relationships (tables, functions, triggers, policies, views, enums,
 * types, FK constraints) as both an interactive HTML graph and Mermaid
 * diagrams.
 *
 * Activated by adding an entry in supabase-tools.config.json:
 *
 *   "plugins": [{
 *     "path": "node_modules/@sbtools/plugin-depgraph",
 *     "config": {}
 *   }]
 */
import fs from "node:fs";
import path from "node:path";
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";
import { hasFlag, openFile, SbtError, ui, loadPackageVersion, resolveConfigPath, withHelp } from "@sbtools/sdk";
import { buildGraph } from "./graph-builder.js";
import { writeDepgraphArtifact } from "./artifact.js";

const PLUGIN_VERSION = loadPackageVersion(import.meta.url);
import { generateMermaid, writeMermaid } from "./mermaid-generator.js";
import { generateHtml, writeHtml } from "./html-generator.js";
import { getDepgraphDashboardView } from "./dashboard.js";

// ---------------------------------------------------------------------------
// Resolved paths
// ---------------------------------------------------------------------------

export function resolvePaths(ctx: PluginContext) {
  const docsDir = ctx.paths.docsOutput;
  const atlasDataPath = path.join(docsDir, "backend-atlas-data.json");
  const snapshotDir = ctx.paths.snapshot;
  const typesFilePath = resolveConfigPath(ctx, "typesFilePath", "src/integrations/supabase/types.ts");
  const htmlOutput = path.join(docsDir, "dependency-graph.html");
  const mermaidOutput = path.join(docsDir, "dependency-graph.md");

  return { docsDir, atlasDataPath, snapshotDir, typesFilePath, htmlOutput, mermaidOutput };
}

// ---------------------------------------------------------------------------
// CLI: depgraph command
// ---------------------------------------------------------------------------

const DEPGRAPH_HELP = `
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

The plugin reads from the atlas data file (produced by 'sbt generate-atlas')
and snapshot files. No running database is required.
`;

async function depgraphCommand(args: string[], ctx: PluginContext): Promise<void> {
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
    ui.error("No nodes found. Ensure 'sbt generate-atlas' has been run first.\n");
    return;
  }

  const onlyHtml = hasFlag(args, "--html");
  const onlyMermaid = hasFlag(args, "--mermaid");
  const onlyJson = hasFlag(args, "--json");
  const shouldOpen = !hasFlag(args, "--no-open");

  if (onlyJson) {
    ui.log(JSON.stringify(graph, null, 2));
    return;
  }

  if (onlyHtml) {
    writeHtml(graph, paths.htmlOutput);
    ui.info(`HTML graph written to ${paths.htmlOutput}`);
    if (shouldOpen) openFile(paths.htmlOutput);
    return;
  }

  if (onlyMermaid) {
    writeMermaid(graph, paths.mermaidOutput);
    ui.info(`Mermaid graph written to ${paths.mermaidOutput}`);
    if (shouldOpen) openFile(paths.mermaidOutput);
    return;
  }

  // Default: generate both, open HTML
  writeHtml(graph, paths.htmlOutput);
  ui.info(`HTML graph written to ${paths.htmlOutput}`);

  writeMermaid(graph, paths.mermaidOutput);
  ui.info(`Mermaid graph written to ${paths.mermaidOutput}`);

  ui.detail(`Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

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
      description: "Generate dependency graph visualizations (HTML + Mermaid)",
      run: withHelp(DEPGRAPH_HELP, depgraphCommand),
    },
  ],

  getAtlasData: async (ctx: PluginContext) => {
    const paths = resolvePaths(ctx);
    const graph = buildGraph(paths.atlasDataPath, paths.snapshotDir, paths.typesFilePath);
    // Artifact is written by command - skip here to avoid redundant writes

    const relationshipCounts = getRelationshipCounts(graph.edges);
    const nodeSummaries = graph.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      schema: n.schema,
    }));

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
            nodes: nodeSummaries,
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

  getDashboardView: () => getDepgraphDashboardView(),

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
