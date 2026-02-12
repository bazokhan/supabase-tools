import fs from "node:fs";
import path from "node:path";
import type { SbtPlugin, PluginContext } from "@sbtools/sdk";
import { ui, hasFlag } from "@sbtools/sdk";
import { generatePackageJson } from "./templates/package-json.js";
import { generateTsconfigJson } from "./templates/tsconfig-json.js";
import { generateIndexTs } from "./templates/index-ts.js";
import { generateRootIndexTs } from "./templates/root-index-ts.js";
import { generateReadmeMd } from "./templates/readme-md.js";
import { generateSkillMd } from "./templates/skill-md.js";

async function scaffoldCommand(args: string[], ctx: PluginContext): Promise<void> {
  if (hasFlag(args, "--help", "-h")) {
    console.log(`
scaffold-plugin — Generate new plugin boilerplate

Usage:
  sbt scaffold-plugin <name> [--external] [--hooks]

Arguments:
  <name>     Plugin name slug (e.g. analytics, my-feature)

Options:
  --external  Create plugin-<name>/ as sibling in project root (external plugin)
  --hooks     Include stub getAtlasData, getAtlasUI, getStatusLines, getOpenApiSpec
  -h, --help  Show this help

Examples:
  sbt scaffold-plugin analytics           → packages/plugin-analytics/
  sbt scaffold-plugin my-plugin --external  → plugin-my-plugin/
  sbt scaffold-plugin dashboard --hooks   → Internal plugin with Atlas hooks
`);
    return;
  }

  const name = args[0];
  if (!name || name.startsWith("-")) {
    ui.error("Plugin name is required. Example: sbt scaffold-plugin my-plugin\n");
    process.exit(1);
  }

  const slug = name.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!slug) {
    ui.error("Invalid plugin name. Use alphanumeric and hyphens only.\n");
    process.exit(1);
  }

  const external = hasFlag(args, "--external");
  const hooks = hasFlag(args, "--hooks");

  const packagesDir = path.dirname(ctx.toolsDir);
  const targetDir = external
    ? path.join(ctx.projectRoot, `plugin-${slug}`)
    : path.join(packagesDir, `plugin-${slug}`);

  if (fs.existsSync(targetDir)) {
    ui.error(`Directory already exists: ${targetDir}\n`);
    process.exit(1);
  }

  ui.step(`Scaffolding ${external ? "external" : "internal"} plugin: ${slug}\n`);

  const srcDir = path.join(targetDir, "src");
  fs.mkdirSync(srcDir, { recursive: true });

  fs.writeFileSync(
    path.join(targetDir, "package.json"),
    generatePackageJson(slug, external),
    "utf8",
  );
  fs.writeFileSync(path.join(targetDir, "tsconfig.json"), generateTsconfigJson(external), "utf8");
  fs.writeFileSync(
    path.join(srcDir, "index.ts"),
    generateIndexTs(slug, external, hooks),
    "utf8",
  );
  fs.writeFileSync(path.join(targetDir, "README.md"), generateReadmeMd(slug, external), "utf8");
  fs.writeFileSync(path.join(targetDir, "SKILL.md"), generateSkillMd(slug, external), "utf8");

  if (external) {
    fs.writeFileSync(path.join(targetDir, "index.ts"), generateRootIndexTs(), "utf8");
  }

  ui.success(`Created ${targetDir}\n`);
  ui.info(`Next steps:\n`);
  if (external) {
    ui.detail(`  1. Add "@sbtools/plugin-${slug}" to devDependencies in root package.json`);
    ui.detail(`  2. Add to supabase-tools.config.json → plugins: [{ "path": "@sbtools/plugin-${slug}", "config": {} }]`);
    ui.detail(`  3. Run npm install, then: sbt ${slug}\n`);
  } else {
    ui.detail(`  1. Add "@sbtools/plugin-${slug}" to devDependencies in root package.json`);
    ui.detail(`  2. Add to supabase-tools.config.json → plugins: [{ "path": "@sbtools/plugin-${slug}", "config": {} }]`);
    ui.detail(`  3. Run npm install, then: sbt ${slug}\n`);
  }
}

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-scaffold",
  version: "1.0.0",

  commands: [
    {
      name: "scaffold-plugin",
      description: "Scaffold a new plugin with consistent boilerplate",
      run: scaffoldCommand,
    },
  ],
};

export default plugin;