/**
 * File discovery and line-by-line scanning for Supabase SDK usage.
 */
import fs from "node:fs";
import path from "node:path";
import { scanLine, type UsageHit } from "./patterns.js";

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

function isTargetFile(filePath: string): boolean {
  return EXTENSIONS.some((ext) => filePath.endsWith(ext));
}

function discoverFiles(dir: string, baseDir: string): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(baseDir, full);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".git" || e.name.startsWith(".")) continue;
      results.push(...discoverFiles(full, baseDir));
    } else if (e.isFile() && isTargetFile(full)) {
      results.push(rel);
    }
  }
  return results;
}

export interface ScanResult {
  file: string;
  component: string;
  hits: UsageHit[];
}

/**
 * Scan a directory for frontend files and extract Supabase usage.
 * Component name = file path without extension (e.g. hooks/usePapers).
 */
export function scanDirectory(
  projectRoot: string,
  scanPaths: string[],
): ScanResult[] {
  const results: ScanResult[] = [];

  for (const scanPath of scanPaths) {
    const absPath = path.isAbsolute(scanPath)
      ? scanPath
      : path.join(projectRoot, scanPath.replace(/\/$/, ""));
    if (!fs.existsSync(absPath)) continue;

    const stat = fs.statSync(absPath);
    const scanDir = stat.isDirectory() ? absPath : path.dirname(absPath);
    const relBase = path.relative(projectRoot, scanDir) || ".";
    const files = stat.isDirectory()
      ? discoverFiles(scanDir, scanDir)
      : [path.basename(absPath)];

    for (const file of files) {
      const fullPath = path.join(scanDir, file);
      if (!fs.existsSync(fullPath) || !isTargetFile(fullPath)) continue;

      const content = fs.readFileSync(fullPath, "utf-8");
      const relPath = path.relative(projectRoot, fullPath);
      const component = relPath.replace(/\.[^.]+$/, "").replace(/\\/g, "/");
      const hits: UsageHit[] = [];
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const lineHits = scanLine(lines[i], i + 1);
        hits.push(...lineHits);
      }

      if (hits.length > 0) {
        results.push({ file: relPath, component, hits });
      }
    }
  }

  return results;
}
