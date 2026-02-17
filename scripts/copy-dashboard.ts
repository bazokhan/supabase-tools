/**
 * Copies the dashboard build from ui-web into core's dist.
 * Run after ui-web and core are built so consumers get the dashboard bundled with core.
 *
 * Run: `tsx scripts/copy-dashboard.ts`
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "packages", "ui-web", "dist", "dashboard");
const DEST = path.join(ROOT, "packages", "core", "dist", "dashboard");

function copyRecursive(src: string, dest: string): void {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (!fs.existsSync(SRC)) {
  console.warn("copy-dashboard: packages/ui-web/dist/dashboard not found. Build ui-web first.");
  process.exit(0);
}

if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true });
copyRecursive(SRC, DEST);
console.log("copy-dashboard: copied dashboard to packages/core/dist/dashboard");
