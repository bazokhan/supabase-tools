/**
 * generate-erd command handler.
 * Orchestrates DB connection, queries, Mermaid build, and markdown output.
 */
import { ui, ensureDir, createPgClient, disconnectClient, getConfigStringArray } from "@sbtools/sdk";
import type { PluginContext } from "@sbtools/sdk";
import { buildMermaid, updateMarkdown } from "./builder.js";
import { fetchTables, fetchColumns, fetchForeignKeys, fetchReferencedEntities } from "./queries.js";
import { resolveErdOutput } from "./paths.js";

export async function runGenerateErd(args: string[], ctx: PluginContext): Promise<void> {
  const displayColumns = getConfigStringArray(ctx, "displayColumns", [
    "name",
    "email",
    "full_name",
    "slug",
    "title",
  ]);
  const OUT_DIR = resolveErdOutput(ctx);

  ui.step("Generating ERD diagrams...\n");

  const client = createPgClient();

  try {
    await client.connect();
    ui.success("Connected\n");

    ensureDir(OUT_DIR);

    const tables = await fetchTables(client);
    ui.info(`Found ${tables.length} tables\n`);

    const columnsByTable = await fetchColumns(client);
    const fksByTable = await fetchForeignKeys(client);
    const referencedEntities = await fetchReferencedEntities(client, fksByTable, displayColumns);

    for (const tableName of tables) {
      const columns = columnsByTable.get(tableName) ?? [];
      const foreignKeys = fksByTable.get(tableName) ?? [];
      const mermaid = buildMermaid(tableName, columns, foreignKeys, referencedEntities);
      updateMarkdown(OUT_DIR, tableName, mermaid);
      ui.detail(`   ${tableName}`);
    }

    await disconnectClient(client);
    ui.success(`\nGenerated ERD diagrams for ${tables.length} tables`);
    ui.info(`Location: ${OUT_DIR}`);
  } catch (error) {
    await disconnectClient(client).catch((err) => {
      if (process.env.SBT_DEBUG === "1") ui.warn(`disconnectClient failed: ${(err as Error).message}`);
    });
    throw error;
  }
}
