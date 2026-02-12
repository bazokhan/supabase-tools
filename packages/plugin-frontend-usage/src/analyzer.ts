/**
 * Aggregates scan results into component→resource mapping, resource lists, and stats.
 */
import type { UsageHit, ResourceType, FrontendUsageData } from "./patterns.js";
import type { ScanResult } from "./scanner.js";

const RESOURCE_TYPES: ResourceType[] = [
  "table",
  "rpc",
  "auth",
  "storage",
  "edge_function",
  "rest_api",
];

export function analyze(results: ScanResult[]): FrontendUsageData {
  const components: Record<string, UsageHit[]> = {};
  const byResource: Record<ResourceType, Set<string>> = {
    table: new Set(),
    rpc: new Set(),
    auth: new Set(),
    storage: new Set(),
    edge_function: new Set(),
    rest_api: new Set(),
  };

  for (const { component, hits } of results) {
    components[component] = hits;
    for (const hit of hits) {
      byResource[hit.type].add(hit.resource);
    }
  }

  const byResourceArrays = {} as Record<ResourceType, string[]>;
  for (const t of RESOURCE_TYPES) {
    byResourceArrays[t] = Array.from(byResource[t]).sort();
  }

  const stats = RESOURCE_TYPES.map((type) => ({
    type,
    count: byResource[type].size,
  })).filter((s) => s.count > 0);

  return {
    components,
    byResource: byResourceArrays,
    stats,
  };
}
