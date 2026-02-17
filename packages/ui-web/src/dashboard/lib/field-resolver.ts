/**
 * Resolves dot-path field strings to values in objects.
 * e.g. resolve(item, "name") -> item.name
 *      resolve(item, "risk.hasDestructive") -> item.risk?.hasDestructive
 */
export function resolve<T>(obj: unknown, path: string): T {
  if (obj == null) return undefined as T;
  const parts = path.split(".");
  let v: unknown = obj;
  for (const p of parts) {
    v = (v as Record<string, unknown>)?.[p];
  }
  return v as T;
}
