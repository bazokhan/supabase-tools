/**
 * Shared text templates. Used by core generators for snapshot file headers.
 */

/**
 * Build the standard snapshot file header comment block.
 * Format:
 *   -- GENERATED: current {objectType}
 *   -- {Key}: {value}  (for each header entry)
 *   -- Do not edit manually. Regenerate via: npm run db:snapshot
 */
export function snapshotFileHeader(opts: {
  objectType: string;
  headers: Record<string, string>;
}): string {
  const { objectType, headers } = opts;
  const headerLines = Object.entries(headers).map(
    ([key, value]) => `-- ${key}: ${value}`
  );
  return `-- GENERATED: current ${objectType}
${headerLines.join("\n")}
-- Do not edit manually. Regenerate via: npm run db:snapshot

`;
}
