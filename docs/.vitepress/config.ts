import { defineConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";
import { copyOrDownloadAsMarkdownButtons } from "vitepress-plugin-llms";

export default defineConfig({
  base: "/supabase-tools/",
  title: "supabase-tools",
  description: "Portable toolkit for local Supabase development",
  vite: {
    plugins: llmstxt() as any,
  },
  markdown: {
    config(md) {
      md.use(copyOrDownloadAsMarkdownButtons);
    },
  },
  themeConfig: {
    search: {
      provider: "local",
    },
    editLink: {
      pattern: "https://github.com/bazokhan/supabase-tools/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
    lastUpdated: {
      text: "Last updated",
    },
    footer: {
      message: "LLM-friendly docs: <a href='/supabase-tools/llms.txt'>llms.txt</a> · <a href='/supabase-tools/llms-full.txt'>llms-full.txt</a>",
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/bazokhan/supabase-tools" },
      { icon: "npm", link: "https://www.npmjs.com/org/sbtools" },
    ],
    nav: [
      { text: "Home", link: "/" },
      { text: "Getting Started", link: "/getting-started" },
      { text: "Plugins", link: "/plugins/" },
      { text: "SDK", link: "/sdk/" },
      { text: "UI Web", link: "/ui-web/" },
      { text: "Changelog", link: "https://github.com/bazokhan/supabase-tools/releases" },
    ],
    sidebar: [
      { text: "Getting Started", link: "/getting-started" },
      { text: "Configuration", link: "/configuration" },
      { text: "CLI Reference", link: "/cli-reference" },
      {
        text: "Plugins",
        collapsed: false,
        items: [
          { text: "Overview", link: "/plugins/" },
          { text: "plugin-db-test", link: "/plugins/plugin-db-test" },
          { text: "plugin-deno-functions", link: "/plugins/plugin-deno-functions" },
          { text: "plugin-depgraph", link: "/plugins/plugin-depgraph" },
          { text: "plugin-erd", link: "/plugins/plugin-erd" },
          { text: "plugin-frontend-usage", link: "/plugins/plugin-frontend-usage" },
          { text: "plugin-logs", link: "/plugins/plugin-logs" },
          { text: "plugin-migration-audit", link: "/plugins/plugin-migration-audit" },
          { text: "plugin-migration-studio", link: "/plugins/plugin-migration-studio" },
          { text: "↳ Studio Platform", link: "/plugins/plugin-migration-studio-platform" },
          { text: "↳ Studio Contributing", link: "/plugins/plugin-migration-studio-contributing" },
          { text: "plugin-scaffold", link: "/plugins/plugin-scaffold" },
          { text: "plugin-typegen", link: "/plugins/plugin-typegen" },
          { text: "docs (built-in)", link: "/plugins/plugin-docs-server" },
        ],
      },
      { text: "Writing Plugins", link: "/writing-plugins" },
      {
        text: "Architecture",
        collapsed: false,
        items: [
          { text: "Overview", link: "/architecture/" },
          { text: "Package Dependencies", link: "/architecture/package-dependencies" },
          { text: "Artifact Registry", link: "/architecture/artifact-registry" },
          { text: "Artifact Contract Guide", link: "/architecture/artifact-contract-guide" },
          { text: "Artifact Compatibility Policy", link: "/architecture/artifact-compatibility-policy" },
          { text: "Implicit File Contracts", link: "/architecture/implicit-file-contracts" },
        ],
      },
      { text: "SDK API", link: "/sdk/" },
      { text: "UI Web", link: "/ui-web/" },
    ],
  },
});
