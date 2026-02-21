import type * as http from "node:http";
import type { PluginContext } from "@sbtools/sdk";

export interface ToolAudienceMetadata {
  title: string;
  whatItDoes: string;
  whenToUse: string;
  whatItNeeds: string[];
  whatItProduces: string[];
  audience?: "backend-dev" | "business" | "mixed";
  controlModes?: Array<"managed" | "assisted" | "loose">;
}

export interface ToolCliDefinition<TInput, TResult> {
  command: string;
  aliases?: string[];
  description: string;
  help: string;
  parseArgs: (args: string[], ctx: PluginContext) => Promise<TInput> | TInput;
  onSuccess?: (result: TResult, ctx: PluginContext) => Promise<void> | void;
}

export interface ToolHttpDefinition<TInput, TResult> {
  method: "GET" | "POST";
  path: string;
  parseRequest: (req: http.IncomingMessage, ctx: PluginContext) => Promise<TInput> | TInput;
  toResponse?: (result: TResult, ctx: PluginContext) => Promise<unknown> | unknown;
}

export interface StudioToolDefinition<TInput = void, TResult = void> {
  id: string;
  run: (ctx: PluginContext, input: TInput) => Promise<TResult>;
  cli?: ToolCliDefinition<TInput, TResult>;
  http?: ToolHttpDefinition<TInput, TResult>;
  workflowEnabled?: boolean;
}

export interface LoadedToolDefinition<TInput = unknown, TResult = unknown> extends StudioToolDefinition<TInput, TResult> {
  metadata: ToolAudienceMetadata;
}

export interface ToolModuleLike {
  tool?: StudioToolDefinition<unknown, unknown>;
  default?: StudioToolDefinition<unknown, unknown>;
  metadata?: ToolAudienceMetadata;
}
