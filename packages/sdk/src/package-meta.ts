/**
 * Load package version from a module's import.meta.url.
 * Replaces the repeated createRequire + require("../package.json") pattern in plugins.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Returns the version string from the package.json of the module at the given importMetaUrl.
 * Typically: loadPackageVersion(import.meta.url)
 */
export function loadPackageVersion(importMetaUrl: string): string {
  const dir = path.dirname(fileURLToPath(importMetaUrl));
  const pkgPath = path.join(dir, "..", "package.json");
  const require = createRequire(importMetaUrl);
  const pkg = require(pkgPath) as { version?: string };
  return pkg.version ?? "0.0.0";
}
