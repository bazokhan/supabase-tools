/**
 * Generate CREATE OR REPLACE FUNCTION migration for PostgREST RPC.
 * Forces schema: public (PostgREST requirement).
 */
import type { PluginContext } from "@sbtools/sdk";
import type { AddFunctionInput } from "./generate-add-function.js";
import { runAddFunction } from "./generate-add-function.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateRpcInput = Omit<AddFunctionInput, "schema">;

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runCreateRpc(
  ctx: PluginContext,
  input: CreateRpcInput
): Promise<{ sql: string; filename: string }> {
  const fullInput: AddFunctionInput = {
    ...input,
    schema: "public",
  };
  return runAddFunction(ctx, fullInput, { filenamePrefix: "create_rpc" });
}
