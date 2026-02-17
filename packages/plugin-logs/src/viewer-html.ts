import { SERVICE_HTML_COLORS } from "./formatter.js";
import { SERVICE_NAMES } from "./docker-logs.js";
import { renderLogsViewerPage } from "@sbtools/ui-web";

export function buildViewerHtml(port: number): string {
  return renderLogsViewerPage({
    port,
    services: [...SERVICE_NAMES],
    serviceColors: SERVICE_HTML_COLORS,
  });
}
