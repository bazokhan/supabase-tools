export interface BuiltinPluginCatalogItem {
  name: string;
  desc: string;
}

export const BUILTIN_PLUGINS: BuiltinPluginCatalogItem[] = [
  { name: "@sbtools/plugin-erd", desc: "ERD diagram generator" },
  { name: "@sbtools/plugin-migration-studio", desc: "SQL editor; apply migrations from browser" },
  { name: "@sbtools/plugin-migration-audit", desc: "Migration drift detection" },
  { name: "@sbtools/plugin-depgraph", desc: "TS function/table dependency graph" },
  { name: "@sbtools/plugin-typegen", desc: "Generate TS types from Supabase" },
  { name: "@sbtools/plugin-db-test", desc: "pgTAP runner via PGlite" },
  { name: "@sbtools/plugin-logs", desc: "Docker logs + pg_stat_statements viewer" },
  { name: "@sbtools/plugin-deno-functions", desc: "Scan and document Edge Functions" },
  { name: "@sbtools/plugin-frontend-usage", desc: "Scan frontend Supabase SDK usage" },
  { name: "@sbtools/plugin-scaffold", desc: "Generate plugin boilerplate" },
];
