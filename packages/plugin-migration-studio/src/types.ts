/**
 * Types for migration studio. Interfaces for schema, templates, and route handlers.
 */
import type * as http from "node:http";
import type { PluginContext } from "@sbtools/sdk";

export interface StudioSchema {
  tables: Record<string, string[]>;
  functions: string[];
  types: string[];
  enums: Record<string, string[]>;
  schemas: string[];
  views: string[];
  source: "database" | "atlas-data" | "artifact" | "none";
}

export interface MigrationTemplate {
  id: string;
  name: string;
  description: string;
  category: "table" | "function" | "policy" | "index" | "trigger" | "type" | "column";
  sql: string;
}

export type RouteHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  ctx: PluginContext
) => Promise<void>;
