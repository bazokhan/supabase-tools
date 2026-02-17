/**
 * Typed plugin config accessors.
 * Replaces unsafe (ctx.pluginConfig.foo as string) ?? default patterns.
 */
import path from "node:path";
import type { PluginContext } from "./plugin-api.js";

/**
 * Get a string config value with fallback.
 */
export function getConfigString(ctx: PluginContext, key: string, fallback: string): string {
  const val = ctx.pluginConfig[key];
  return typeof val === "string" ? val : fallback;
}

/**
 * Get a number config value with fallback.
 */
export function getConfigNumber(ctx: PluginContext, key: string, fallback: number): number {
  const val = ctx.pluginConfig[key];
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (typeof val === "string") {
    const n = Number.parseInt(val, 10);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

/**
 * Get a string array config value with fallback.
 */
export function getConfigStringArray(ctx: PluginContext, key: string, fallback: string[]): string[] {
  const val = ctx.pluginConfig[key];
  if (Array.isArray(val)) {
    return val.map((x) => String(x)).filter(Boolean);
  }
  return fallback;
}

/**
 * Resolve a path from plugin config. Handles absolute vs relative paths.
 * Relative paths are resolved against ctx.projectRoot.
 */
export function resolveConfigPath(ctx: PluginContext, key: string, fallbackRelPath: string): string {
  const val = ctx.pluginConfig[key];
  const pathStr = typeof val === "string" ? val : fallbackRelPath;
  return path.isAbsolute(pathStr) ? pathStr : path.resolve(ctx.projectRoot, pathStr);
}
