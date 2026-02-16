/**
 * Produces the openapi.partial.deno-functions versioned artifact.
 * Written whenever edge functions are extracted so docs-server can consume it
 * for deterministic OpenAPI merge instead of calling getOpenApiSpec at runtime.
 */
import { writeArtifact, type ArtifactEnvelope } from "@sbtools/sdk";
import type { PluginContext } from "@sbtools/sdk";
import { generateEdgeFunctionOpenApi } from "./openapi.js";
import type { EdgeFunctionItem } from "./extractor.js";

/** Schema version for openapi.partial.deno-functions artifact. */
export const OPENAPI_PARTIAL_DENO_FUNCTIONS_VERSION = "1.0.0";

/** Partial OpenAPI spec (paths, components, tags) for merge. */
export interface OpenApiPartialDenoFunctionsData {
  paths: Record<string, Record<string, unknown>>;
  components: Record<string, Record<string, unknown>>;
  tags: Array<{ name: string; description?: string }>;
}

function toPartialSpec(
  fullSpec: ReturnType<typeof generateEdgeFunctionOpenApi>
): OpenApiPartialDenoFunctionsData {
  return {
    paths: fullSpec.paths,
    components: fullSpec.components,
    tags: [{ name: "Edge Functions", description: "Supabase Edge Functions" }],
  };
}

/**
 * Write the openapi.partial.deno-functions artifact.
 * Call with extracted items when producer needs to persist for docs-server consumption.
 */
export function writeOpenApiPartialArtifact(
  ctx: PluginContext,
  items: EdgeFunctionItem[],
  opts: { baseUrl: string; pluginVersion: string }
): void {
  const fullSpec = generateEdgeFunctionOpenApi(items, {
    apiUrl: ctx.apiUrl,
    baseUrl: opts.baseUrl,
  });
  const envelope: ArtifactEnvelope<OpenApiPartialDenoFunctionsData> = {
    id: "openapi.partial.deno-functions",
    version: OPENAPI_PARTIAL_DENO_FUNCTIONS_VERSION,
    producer: "@sbtools/plugin-deno-functions",
    generatedAt: new Date().toISOString(),
    schemaRef: `https://sbtools.dev/contracts/openapi.partial.deno-functions/${OPENAPI_PARTIAL_DENO_FUNCTIONS_VERSION}`,
    inputs: {
      projectRoot: ctx.projectRoot,
      functionsPath: ctx.paths.functions,
    },
    meta: { toolVersion: opts.pluginVersion },
    data: toPartialSpec(fullSpec),
  };
  writeArtifact(ctx, envelope);
}
