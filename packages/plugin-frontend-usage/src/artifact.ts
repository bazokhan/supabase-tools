/**
 * Produces the frontend.usage versioned artifact.
 * Written whenever frontend usage is scanned for reuse by other consumers.
 */
import { writeArtifact, type ArtifactEnvelope } from "@sbtools/sdk";
import type { PluginContext } from "@sbtools/sdk";
import type { FrontendUsageData } from "./patterns.js";

/** Schema version for frontend.usage artifact. */
export const FRONTEND_USAGE_VERSION = "1.0.0";

/**
 * Write the frontend.usage artifact.
 */
export function writeFrontendUsageArtifact(
  ctx: PluginContext,
  data: FrontendUsageData,
  opts?: { scanPaths?: string[]; pluginVersion?: string }
): void {
  const envelope: ArtifactEnvelope<FrontendUsageData> = {
    id: "frontend.usage",
    version: FRONTEND_USAGE_VERSION,
    producer: "@sbtools/plugin-frontend-usage",
    generatedAt: new Date().toISOString(),
    schemaRef: `https://sbtools.dev/contracts/frontend.usage/${FRONTEND_USAGE_VERSION}`,
    inputs: {
      projectRoot: ctx.projectRoot,
      ...(opts?.scanPaths && { scanPaths: opts.scanPaths.join(",") }),
    },
    meta: { toolVersion: opts?.pluginVersion ?? "unknown" },
    data,
  };
  writeArtifact(ctx, envelope);
}
