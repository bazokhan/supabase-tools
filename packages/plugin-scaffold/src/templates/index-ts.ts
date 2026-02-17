export function generateIndexTs(name: string, external: boolean, hooks: boolean): string {
  const pluginName = `@sbtools/plugin-${name}`;
  const cmdName = name;

  let hooksBlock = "";
  if (hooks) {
    hooksBlock = `

  getAtlasData: async (ctx) => {
    return { categories: {}, stats: [] };
  },

  getDashboardView: () => ({ sections: [] }),

  getStatusLines: async () => ["  (no status)"],

  getOpenApiSpec: async () => ({}),
`;
  }

  return `import type { SbtPlugin, PluginContext } from "@sbtools/sdk";

const plugin: SbtPlugin = {
  name: "${pluginName}",
  version: "1.0.0",
  // Declare artifact IDs this plugin produces/consumes (enables artifact-first collaboration)
  // artifactCapabilities: { produces: ["my.artifact"], consumes: [] },

  commands: [
    {
      name: "${cmdName}",
      description: "${name} plugin command",
      async run(args: string[], ctx: PluginContext): Promise<void> {
        console.log("${cmdName} command running with args:", args);
      },
    },
  ],${hooksBlock}
};

export default plugin;
`;
}
