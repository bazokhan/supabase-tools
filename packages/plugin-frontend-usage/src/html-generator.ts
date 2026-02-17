import type { FrontendUsageData } from "./patterns.js";
import type { ScanResult } from "./scanner.js";
import { renderFrontendUsagePage } from "@sbtools/ui-web";

export function generateHtml(
  data: FrontendUsageData,
  scanResults: ScanResult[],
): string {
  return renderFrontendUsagePage(
    data,
    scanResults.map((r) => ({
      file: r.file,
      component: r.component,
      hitCount: r.hits.length,
    })),
  );
}
