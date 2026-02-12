import { defineConfig } from "vitepress";

export default defineConfig({
  base: "/supabase-tools/",
  title: "supabase-tools",
  description: "Portable toolkit for local Supabase development",
  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "Getting Started", link: "/getting-started" },
      { text: "Plugins", link: "/plugins/" },
      { text: "SDK", link: "/sdk/" },
    ],
    sidebar: [
      { text: "Getting Started", link: "/getting-started" },
      { text: "Configuration", link: "/configuration" },
      { text: "Publishing", link: "/publishing" },
      {
        text: "Plugins",
        collapsed: false,
        items: [
          { text: "Overview", link: "/plugins/" },
          { text: "plugin-atlas-html", link: "/plugins/plugin-atlas-html" },
          { text: "plugin-db-test", link: "/plugins/plugin-db-test" },
          { text: "plugin-deno-functions", link: "/plugins/plugin-deno-functions" },
          { text: "plugin-depgraph", link: "/plugins/plugin-depgraph" },
          { text: "plugin-docs-server", link: "/plugins/plugin-docs-server" },
          { text: "plugin-erd", link: "/plugins/plugin-erd" },
          { text: "plugin-frontend-usage", link: "/plugins/plugin-frontend-usage" },
          { text: "plugin-logs", link: "/plugins/plugin-logs" },
          { text: "plugin-scaffold", link: "/plugins/plugin-scaffold" },
          { text: "plugin-typegen", link: "/plugins/plugin-typegen" },
        ],
      },
      { text: "SDK API", link: "/sdk/" },
    ],
  },
});
