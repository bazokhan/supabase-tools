import path from "node:path";
import { resolveConfigPath } from "@sbtools/sdk";
import type { PluginContext } from "@sbtools/sdk";

/** Resolve the ERD output directory from plugin context. */
export function resolveErdOutput(ctx: PluginContext): string {
  return resolveConfigPath(ctx, "erdOutput", path.join(ctx.paths.docsOutput, "entity-relations"));
}
