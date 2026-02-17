/**
 * Produces the depgraph.graph versioned artifact.
 * Written whenever the dependency graph is built for reuse by other consumers.
 */
import { createArtifactWriter } from "@sbtools/sdk";
import type { PluginContext } from "@sbtools/sdk";
import type { DependencyGraph } from "./graph-builder.js";

/** Schema version for depgraph.graph artifact. */
export const DEPGRAPH_GRAPH_VERSION = "1.0.0";

const writeDepgraphArtifactFn = createArtifactWriter<DependencyGraph>({
  id: "depgraph.graph",
  version: DEPGRAPH_GRAPH_VERSION,
  producer: "@sbtools/plugin-depgraph",
});

/**
 * Write the depgraph.graph artifact.
 */
export function writeDepgraphArtifact(
  ctx: PluginContext,
  graph: DependencyGraph,
  opts?: { atlasDataPath?: string; snapshotDir?: string; pluginVersion?: string }
): void {
  writeDepgraphArtifactFn(ctx, graph, {
    inputs: {
      ...(opts?.atlasDataPath && { atlasDataPath: opts.atlasDataPath }),
      ...(opts?.snapshotDir && { snapshotDir: opts.snapshotDir }),
    },
    meta: { toolVersion: opts?.pluginVersion ?? "unknown" },
  });
}
