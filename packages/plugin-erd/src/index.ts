import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { ui, ensureDir } from "@sbtools/sdk";
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";
import { buildMermaid, updateMarkdown, mapType } from "./builder.js";
import type { ColumnInfo, ForeignKeyInfo, ReferencedColumn } from "./builder.js";

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-erd",
  version: "1.0.0",

  commands: [
    {
      name: "generate-erd",
      description: "Generate Mermaid ERD diagrams for each public table",
      async run(args: string[], ctx: PluginContext): Promise<void> {
        const displayColumns = (ctx.pluginConfig.displayColumns as string[]) ?? [
          "name", "email", "full_name", "slug", "title",
        ];
        const erdOutput = (ctx.pluginConfig.erdOutput as string) ??
          path.join(ctx.paths.docsOutput, "entity-relations");
        const OUT_DIR = path.isAbsolute(erdOutput)
          ? erdOutput
          : path.resolve(ctx.projectRoot, erdOutput);

        ui.step("Generating ERD diagrams...\n");

        const dbUrl =
          process.env.DATABASE_URL ||
          process.env.SUPABASE_DB_URL ||
          process.env.POSTGRES_URL ||
          "postgresql://postgres:postgres@localhost:54322/postgres";

        const client = new Client({ connectionString: dbUrl });

        try {
          await client.connect();
          ui.success("Connected\n");

          ensureDir(OUT_DIR);

          // 1. List all public tables
          const tablesResult = await client.query<{ tablename: string }>(
            `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
          );
          const tables = tablesResult.rows.map((r) => r.tablename);
          ui.info(`Found ${tables.length} tables\n`);

          // 2. Get columns with PK/FK flags
          const columnsResult = await client.query<{
            table_name: string;
            column_name: string;
            data_type: string;
            udt_name: string;
            is_nullable: string;
            is_primary_key: boolean;
            is_foreign_key: boolean;
          }>(`
            SELECT
              c.table_name, c.column_name, c.data_type, c.udt_name, c.is_nullable,
              COALESCE(pk.is_pk, false) AS is_primary_key,
              COALESCE(fk.is_fk, false) AS is_foreign_key
            FROM information_schema.columns c
            LEFT JOIN LATERAL (
              SELECT true AS is_pk FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
              WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = c.table_schema AND tc.table_name = c.table_name AND kcu.column_name = c.column_name LIMIT 1
            ) pk ON true
            LEFT JOIN LATERAL (
              SELECT true AS is_fk FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
              WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = c.table_schema AND tc.table_name = c.table_name AND kcu.column_name = c.column_name LIMIT 1
            ) fk ON true
            WHERE c.table_schema = 'public'
            ORDER BY c.table_name, c.ordinal_position
          `);

          const columnsByTable = new Map<string, ColumnInfo[]>();
          for (const row of columnsResult.rows) {
            const list = columnsByTable.get(row.table_name) ?? [];
            list.push({
              column_name: row.column_name,
              data_type: row.data_type,
              udt_name: row.udt_name,
              is_nullable: row.is_nullable,
              is_primary_key: row.is_primary_key,
              is_foreign_key: row.is_foreign_key,
            });
            columnsByTable.set(row.table_name, list);
          }

          // 3. Get foreign keys
          const fkResult = await client.query<{
            table_name: string;
            column_name: string;
            foreign_table_schema: string;
            foreign_table_name: string;
            foreign_column_name: string;
            delete_rule: string;
            is_nullable: string;
          }>(`
            SELECT
              kcu.table_name, kcu.column_name,
              ccu.table_schema AS foreign_table_schema, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name,
              rc.delete_rule, c.is_nullable
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.constraint_schema
            JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
            JOIN information_schema.columns c ON c.table_schema = kcu.table_schema AND c.table_name = kcu.table_name AND c.column_name = kcu.column_name
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
            ORDER BY kcu.table_name, kcu.ordinal_position
          `);

          const fksByTable = new Map<string, ForeignKeyInfo[]>();
          for (const row of fkResult.rows) {
            const list = fksByTable.get(row.table_name) ?? [];
            list.push({
              column_name: row.column_name,
              foreign_table_schema: row.foreign_table_schema,
              foreign_table_name: row.foreign_table_name,
              foreign_column_name: row.foreign_column_name,
              delete_rule: row.delete_rule,
              is_nullable: row.is_nullable,
            });
            fksByTable.set(row.table_name, list);
          }

          // 4. Collect referenced entities
          const referencedEntities = new Map<string, ReferencedColumn[]>();
          const refTableKeys = new Set<string>();
          for (const fks of fksByTable.values()) {
            for (const fk of fks) {
              refTableKeys.add(`${fk.foreign_table_schema}.${fk.foreign_table_name}`);
            }
          }

          for (const key of refTableKeys) {
            const [schema, table] = key.split(".");

            if (schema === "auth" && table === "users") {
              referencedEntities.set(key, [
                { column_name: "id", is_primary_key: true, is_foreign_key: false, data_type: "uuid", udt_name: "uuid" },
                { column_name: "email", is_primary_key: false, is_foreign_key: false, data_type: "text", udt_name: "text" },
              ]);
              continue;
            }

            const refColsResult = await client.query<ReferencedColumn & { data_type: string; udt_name: string }>(`
              SELECT c.column_name, c.data_type, c.udt_name,
                COALESCE(pk.is_pk, false) AS is_primary_key,
                COALESCE(fk.is_fk, false) AS is_foreign_key
              FROM information_schema.columns c
              LEFT JOIN LATERAL (
                SELECT true AS is_pk FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = c.table_schema AND tc.table_name = c.table_name AND kcu.column_name = c.column_name LIMIT 1
              ) pk ON true
              LEFT JOIN LATERAL (
                SELECT true AS is_fk FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = c.table_schema AND tc.table_name = c.table_name AND kcu.column_name = c.column_name LIMIT 1
              ) fk ON true
              WHERE c.table_schema = $1 AND c.table_name = $2
                AND (
                  COALESCE((SELECT true FROM information_schema.table_constraints tc2
                    JOIN information_schema.key_column_usage kcu2 ON tc2.constraint_name = kcu2.constraint_name AND tc2.table_schema = kcu2.table_schema
                    WHERE tc2.constraint_type = 'PRIMARY KEY' AND tc2.table_schema = c.table_schema AND tc2.table_name = c.table_name AND kcu2.column_name = c.column_name LIMIT 1
                  ), false) = true
                  OR c.column_name = ANY($3)
                )
              ORDER BY c.ordinal_position
            `, [schema, table, displayColumns]);

            if (refColsResult.rows.length > 0) {
              referencedEntities.set(key, refColsResult.rows.map((r) => ({
                column_name: r.column_name,
                is_primary_key: r.is_primary_key,
                is_foreign_key: r.is_foreign_key,
                data_type: r.data_type,
                udt_name: r.udt_name,
              })));
            }
          }

          // 5. Generate ERDs
          for (const tableName of tables) {
            const columns = columnsByTable.get(tableName) ?? [];
            const foreignKeys = fksByTable.get(tableName) ?? [];
            const mermaid = buildMermaid(tableName, columns, foreignKeys, referencedEntities);
            updateMarkdown(OUT_DIR, tableName, mermaid);
            ui.detail(`   ${tableName}`);
          }

          await client.end();
          ui.success(`\nGenerated ERD diagrams for ${tables.length} tables`);
          ui.info(`Location: ${OUT_DIR}`);
        } catch (error) {
          await client.end().catch(() => {});
          throw error;
        }
      },
    },
  ],
};

export default plugin;
