import { loadPackageVersion, withHelp } from "@sbtools/sdk";
import type { SbtPlugin } from "@sbtools/sdk";
import { runGenerateErd } from "./erd-command.js";
import { resolveErdOutput } from "./paths.js";

export { resolveErdOutput } from "./paths.js";

const GENERATE_ERD_HELP = `
generate-erd — Generate Mermaid ERD diagrams for each public table

Usage:
  sbt generate-erd

Output: Creates entity-relations/*.md in docs output (configurable via erdOutput).
`;

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-erd",
  version: loadPackageVersion(import.meta.url),

  commands: [
    {
      name: "generate-erd",
      description: "Generate Mermaid ERD diagrams for each public table",
      run: withHelp(GENERATE_ERD_HELP, runGenerateErd),
    },
  ],
};

export default plugin;
