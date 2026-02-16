/**
 * Produces the frontend.usage versioned artifact.
 * Written whenever frontend usage is scanned for reuse by other consumers.
 */
import { createArtifactWriter } from "@sbtools/sdk";
import type { PluginContext } from "@sbtools/sdk";
import type { FrontendUsageData } from "./patterns.js";

/** Schema version for frontend.usage artifact. */
export const FRONTEND_USAGE_VERSION = "1.0.0";

const writeFrontendUsageFn = createArtifactWriter<FrontendUsageData>({
  id: "frontend.usage",
  version: FRONTEND_USAGE_VERSION,
  producer: "@sbtools/plugin-frontend-usage",
});

/**
 * Write the frontend.usage artifact.
 */
export function writeFrontendUsageArtifact(
  ctx: PluginContext,
  data: FrontendUsageData,
  opts?: { scanPaths?: string[]; pluginVersion?: string }
): void {
  writeFrontendUsageFn(ctx, data, {
    inputs: opts?.scanPaths ? { scanPaths: opts.scanPaths.join(",") } : undefined,
    meta: { toolVersion: opts?.pluginVersion ?? "unknown" },
  });
}
