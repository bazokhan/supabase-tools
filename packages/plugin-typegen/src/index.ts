import fs from "node:fs";
import path from "node:path";
import { ui, SbtError, extractComposeKey } from "@sbtools/sdk";
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-typegen",
  version: "1.0.0",

  commands: [
    {
      name: "generate-types",
      description: "Generate TypeScript types from the running Supabase instance",
      async run(_args: string[], ctx: PluginContext): Promise<void> {
        const typesOutput = (ctx.pluginConfig.typesOutput as string) ??
          path.join(ctx.projectRoot, "src", "integrations", "supabase", "types.ts");
        const OUT_PATH = path.isAbsolute(typesOutput)
          ? typesOutput
          : path.resolve(ctx.projectRoot, typesOutput);

        const composePath = path.join(ctx.toolsDir, "docker-compose.db.yml");

        if (!fs.existsSync(composePath)) {
          throw new SbtError("COMMAND_FAILED", `Could not read ${composePath}`, {
            tips: ["Ensure docker-compose.db.yml exists in the supabase-tools directory"],
          });
        }

        const serviceKey = extractComposeKey(composePath, [
          /SUPABASE_SERVICE_ROLE_KEY:\s*([^\s]+)/,
          /SUPABASE_SERVICE_KEY:\s*([^\s]+)/,
          /SERVICE_KEY:\s*([^\s]+)/,
        ]);

        if (!serviceKey) {
          throw new SbtError("COMMAND_FAILED", "Service role key not found in docker-compose.db.yml.", {
            tips: ["Ensure docker-compose.db.yml contains SUPABASE_SERVICE_ROLE_KEY"],
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
      },
    },
  ],
};

export default plugin;
