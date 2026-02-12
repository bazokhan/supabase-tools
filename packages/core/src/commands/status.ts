import path from "node:path";
import { ui, extractComposeKey } from "@sbtools/sdk";
import { config } from "../config.js";
import { loadPlugins, buildPluginContext } from "../plugin-loader.js";

export async function runStatus(): Promise<void> {
  const composePath = path.join(config.toolsDir, "docker-compose.db.yml");

  const anonKey = extractComposeKey(composePath, [/SUPABASE_ANON_KEY:\s*([^\s]+)/, /ANON_KEY:\s*([^\s]+)/]);
  const serviceKey = extractComposeKey(composePath, [/SUPABASE_SERVICE_ROLE_KEY:\s*([^\s]+)/, /SUPABASE_SERVICE_KEY:\s*([^\s]+)/, /SERVICE_KEY:\s*([^\s]+)/]);
  const jwtSecret = extractComposeKey(composePath, [/JWT_SECRET:\s*([^\s]+)/, /AUTH_JWT_SECRET:\s*([^\s]+)/]);

  const api = config.api.url;

  ui.log([
    "Supabase Local Status",
    "----------------------",
    `API URL:              ${api}`,
    `REST URL:             ${api}/rest/v1`,
    `GraphQL URL:          ${api}/graphql/v1`,
    `Realtime URL:         ${api}/realtime/v1`,
    `Functions URL:        ${api}/functions/v1`,
    `Storage URL:          ${api}/storage/v1`,
    `S3 URL:               ${api}/storage/v1/s3`,
    `Meta URL (pg-meta):   ${api}/pg`,
    `DB URL:               ${config.db.url}`,
    `Studio URL:           ${config.api.studioUrl}`,
    `Inbucket URL:         ${config.api.inbucketUrl}`,
    "",
    `JWT secret:           ${jwtSecret || "<not found in docker-compose>"}`,
    `anon key:             ${anonKey || "<not found in docker-compose>"}`,
    `service_role key:     ${serviceKey || "<not found in docker-compose>"}`,
  ].join("\n"));

  // --- Plugin status contributions ---
  const loaded = await loadPlugins();
  for (const entry of loaded) {
    if (entry.plugin.getStatusLines) {
      try {
        const ctx = buildPluginContext(entry);
        const lines = await entry.plugin.getStatusLines(ctx);
        if (lines.length > 0) {
          ui.blank();
          ui.heading(`${entry.plugin.name}:`);
          ui.log("----------------------");
          for (const line of lines) ui.log(line);
        }
      } catch (err) {
        ui.warn(`⚠️  Plugin "${entry.plugin.name}" getStatusLines failed: ${(err as Error).message}`);
      }
    }
  }
}
