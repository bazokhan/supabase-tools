import fs from "node:fs";
import path from "node:path";
import type { DependencyGraph } from "./graph-builder.js";
import { renderDepgraphPage } from "@sbtools/ui-web";

export function generateHtml(graph: DependencyGraph): string {
  return renderDepgraphPage(graph);
}

export function writeHtml(
  graph: DependencyGraph,
  outputPath: string,
): void {
  const content = generateHtml(graph);
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, content, "utf-8");
}
