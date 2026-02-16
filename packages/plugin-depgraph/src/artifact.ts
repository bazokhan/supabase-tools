/**
 * Produces the depgraph.graph versioned artifact.
 * Written whenever the dependency graph is built for reuse by other consumers.
 */
import { writeArtifact, type ArtifactEnvelope } from "@sbtools/sdk";
import type { PluginContext } from "@sbtools/sdk";
import type { DependencyGraph } from "./graph-builder.js";

/** Schema version for depgraph.graph artifact. */
export const DEPGRAPH_GRAPH_VERSION = "1.0.0";

/**
 * Write the depgraph.graph artifact.
 */
export function writeDepgraphArtifact(
  ctx: PluginContext,
  graph: DependencyGraph,
  opts?: { atlasDataPath?: string; snapshotDir?: string; pluginVersion?: string }
): void {
  const envelope: ArtifactEnvelope<DependencyGraph> = {
    id: "depgraph.graph",
    version: DEPGRAPH_GRAPH_VERSION,
    producer: "@sbtools/plugin-depgraph",
    generatedAt: new Date().toISOString(),
    schemaRef: `https://sbtools.dev/contracts/depgraph.graph/${DEPGRAPH_GRAPH_VERSION}`,
    inputs: {
      projectRoot: ctx.projectRoot,
      ...(opts?.atlasDataPath && { atlasDataPath: opts.atlasDataPath }),
      ...(opts?.snapshotDir && { snapshotDir: opts.snapshotDir }),
    },
    meta: { toolVersion: opts?.pluginVersion ?? "unknown" },
    data: graph,
  };
  writeArtifact(ctx, envelope);
}
