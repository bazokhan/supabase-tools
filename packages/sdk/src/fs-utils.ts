/**
 * Filesystem utilities shared across supabase-tools ecosystem.
 */
import fs from "node:fs";
import path from "node:path";

/**
 * Ensures a directory exists, creating it and any parent directories if needed.
 */
export function ensureDir(p: string): void {
    fs.mkdirSync(p, { recursive: true });
}

/**
 * Writes content to a file under a base directory. Ensures the file's parent directory exists.
 */
export function writeFileInDir(baseDir: string, relPath: string, content: string): void {
    const abs = path.join(baseDir, relPath);
    ensureDir(path.dirname(abs));
    fs.writeFileSync(abs, content, "utf8");
}

/**
 * Reads a file as UTF-8 text.
 */
export function readText(p: string): string {
    return fs.readFileSync(p, "utf8");
}

/**
 * Replaces any character that is not word, dot, or hyphen with an underscore.
 * Safe for use in filenames and path segments.
 */
export function safeName(s: string): string {
    return s.replace(/[^\w.-]/g, "_");
}

/**
 * Sanitizes a string into a hyphenated slug (e.g. plugin names, directory names).
 * Keeps alphanumeric and hyphens, collapses runs of hyphens, trims.
 */
export function sanitizeSlug(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Sanitizes a string for use as an identifier (e.g. Mermaid node IDs).
 * Keeps alphanumeric and underscores only.
 */
export function sanitizeIdentifier(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * Truncates a filename to a maximum length and appends a short hash to avoid collisions.
 * Keeps extension intact.
 */
export function safeFileName(baseName: string, maxLength: number = 180): string {
    if (baseName.length <= maxLength) {
        return baseName;
    }
    let hash = 0;
    for (let i = 0; i < baseName.length; i++) {
        const char = baseName.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    const hashStr = Math.abs(hash).toString(36).slice(0, 8);
    const ext = path.extname(baseName);
    const nameWithoutExt = baseName.slice(0, maxLength - ext.length - hashStr.length - 1);
    return `${nameWithoutExt}_${hashStr}${ext}`;
}
