import fs from "node:fs";
import path from "node:path";
import { ui, ensureDir, SbtError } from "@sbtools/sdk";
import type { SbtPlugin, PluginContext, PluginAtlasUI } from "@sbtools/sdk";
import { atlasStyles } from "./atlas/styles/base.js";
import { cardStyles } from "./atlas/styles/cards.js";
import { sectionStyles } from "./atlas/styles/sections.js";
import { buildDocument } from "./layout.js";
import { heroHtml } from "./atlas/views/hero.js";
import { controlsHtml } from "./atlas/views/controls.js";
import { sectionsHtml } from "./atlas/views/sections.js";
import { buildClientScript } from "./atlas/bootstrap.js";

const plugin: SbtPlugin = {
  name: "@sbtools/plugin-atlas-html",
  version: "1.0.0",

  commands: [
    {
      name: "atlas-html",
      description: "Generate the Backend Atlas HTML visualization",
      async run(_args: string[], ctx: PluginContext): Promise<void> {
        const dataFile = path.join(ctx.paths.docsOutput, "backend-atlas-data.json");
        if (!fs.existsSync(dataFile)) {
          throw new SbtError("PREFLIGHT_FAILED", "backend-atlas-data.json not found.", {
            tips: ["Run `sbt generate-atlas` first to generate the atlas data."],
          });
        }

        const OUT_DIR = ctx.paths.docsOutput;
        const OUT_FILE = path.join(OUT_DIR, "backend-atlas.html");
        ensureDir(OUT_DIR);

        // Collect plugin UI contributions from sibling plugins
        const mergedKindLabels: Record<string, string> = {};
        let mergedSectionHtml = "";
        let mergedCardRendererJs = "";
        let mergedInitJs = "";
        let mergedStyles = "";

        for (const entry of ctx.siblingPlugins ?? []) {
          if (entry.getAtlasUI) {
            try {
              const uiData = entry.getAtlasUI();
              Object.assign(mergedKindLabels, uiData.kindLabels);
              mergedSectionHtml += uiData.sectionHtml;
              mergedCardRendererJs += "\n" + uiData.cardRendererJs;
              mergedInitJs += "\n      " + uiData.initJs;
              mergedStyles += "\n" + uiData.styles;
            } catch (err) {
              ui.warn(`Plugin "${entry.name}" getAtlasUI failed: ${(err as Error).message}`);
            }
          }
        }

        const bodyHtml = heroHtml() + controlsHtml() + sectionsHtml(mergedSectionHtml);
        const scriptJs = buildClientScript({
          pluginKindLabels: mergedKindLabels,
          pluginCardRendererJs: mergedCardRendererJs,
          pluginInitJs: mergedInitJs,
        });
        const styles = atlasStyles() + cardStyles() + sectionStyles() + mergedStyles;

        const html = buildDocument({ styles, bodyHtml, scriptJs });
        fs.writeFileSync(OUT_FILE, html, "utf8");
        ui.success("Backend atlas HTML written to docs/backend-atlas.html");
      },
    },
  ],

  getAtlasUI(): PluginAtlasUI {
    return {
      kindLabels: {},
      sectionHtml: "",
      cardRendererJs: "",
      initJs: "",
      styles: "",
    };
  },
};

export default plugin;
