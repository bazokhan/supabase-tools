import fs from "node:fs";
import path from "node:path";
import { ui, SbtError, extractSupabaseKeys, loadPackageVersion, resolveConfigPath, COMPOSE_DB_FILE, withHelp } from "@sbtools/sdk";
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";

/** Resolve the types output file path from plugin context. */
export function resolveTypesOutput(ctx: PluginContext): string {
  return resolveConfigPath(ctx, "typesOutput", "src/integrations/supabase/types.ts");
}

const GENERATE_TYPES_HELP = `
generate-types — Generate TypeScript types from the running Supabase instance

Usage:
  sbt generate-types

Output: src/integrations/supabase/types.ts (or configured typesOutput)

Requires the database to be running (sbt start).
Set SUPABASE_TYPES_SCHEMAS to restrict schemas (e.g. public,auth).
`;

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-typegen",
  version: loadPackageVersion(import.meta.url),

  commands: [
    {
      name: "generate-types",
      description: "Generate TypeScript types from the running Supabase instance",
      run: withHelp(GENERATE_TYPES_HELP, async (_args: string[], ctx: PluginContext): Promise<void> => {
        const OUT_PATH = resolveTypesOutput(ctx);

        const composePath = path.join(ctx.toolsDir, COMPOSE_DB_FILE);

        if (!fs.existsSync(composePath)) {
          throw new SbtError("COMMAND_FAILED", `Could not read ${composePath}`, {
            tips: [`Ensure ${COMPOSE_DB_FILE} exists in the supabase-tools directory`],
          });
        }

        const { serviceKey } = extractSupabaseKeys(composePath);

        if (!serviceKey) {
          throw new SbtError("COMMAND_FAILED", `Service role key not found in ${COMPOSE_DB_FILE}.`, {
            tips: [`Ensure ${COMPOSE_DB_FILE} contains SUPABASE_SERVICE_ROLE_KEY`],
          });
        }

        const schemas = process.env.SUPABASE_TYPES_SCHEMAS;
        const baseUrl = `${ctx.apiUrl}/pg/generators/typescript`;
        const headers: Record<string, string> = {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        };

        const tryFetch = async (url: string): Promise<{ ok: boolean; status?: number; text: string }> => {
          const res = await fetch(url, { headers });
          if (!res.ok) return { ok: false, status: res.status, text: await res.text() };
          return { ok: true, text: await res.text() };
        };

        const buildUrls = (): string[] => {
          if (!schemas) return [baseUrl];
          const encoded = encodeURIComponent(schemas);
          return [
            `${baseUrl}?includedSchemas=${encoded}`,
            `${baseUrl}?included_schemas=${encoded}`,
            baseUrl,
          ];
        };

        let body: string | null = null;
        let lastError: string | null = null;

        for (const url of buildUrls()) {
          const result = await tryFetch(url);
          if (result.ok) { body = result.text; break; }
          lastError = `${result.status}: ${result.text}`;
        }

        if (!body) {
          throw new SbtError("COMMAND_FAILED", `Failed to generate types. ${lastError ?? ""}`.trim(), {
            tips: ["Ensure the database is running: `sbt start`"],
          });
        }

        fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
        fs.writeFileSync(OUT_PATH, body, "utf8");
        ui.success(`Generated types at ${path.relative(ctx.projectRoot, OUT_PATH)}`);
      }),
    },
  ],
};

export default plugin;
