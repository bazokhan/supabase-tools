/**
 * atlas-html command — Generate the Backend Atlas HTML visualization.
 * Moved from plugin-atlas-html into core.
 */
import fs from "node:fs";
import path from "node:path";
import { ui, ensureDir, SbtError, withHelp } from "@sbtools/sdk";
import type { PluginContext } from "@sbtools/sdk";
import { atlasStyles } from "../atlas/styles/base.js";
import { cardStyles } from "../atlas/styles/cards.js";
import { sectionStyles } from "../atlas/styles/sections.js";
import { buildDocument } from "../atlas/layout.js";
import { heroHtml } from "../atlas/views/hero.js";
import { controlsHtml } from "../atlas/views/controls.js";
import { sectionsHtml } from "../atlas/views/sections.js";
import { buildClientScript } from "../atlas/bootstrap.js";

const ATLAS_HTML_HELP = `
atlas-html — Generate the Backend Atlas HTML visualization

Usage:
  sbt atlas-html

Output: docs/backend-atlas.html (or paths.docsOutput)

Requires backend-atlas-data.json (run \`sbt generate-atlas\` first).
`;

async function runAtlasHtml(args: string[], ctx: PluginContext): Promise<void> {
  const dataFile = path.join(ctx.paths.docsOutput, "backend-atlas-data.json");
  if (!fs.existsSync(dataFile)) {
    throw new SbtError("PREFLIGHT_FAILED", "backend-atlas-data.json not found.", {
      tips: ["Run `sbt generate-atlas` first to generate the atlas data."],
    });
  }

  const OUT_DIR = ctx.paths.docsOutput;
  const OUT_FILE = path.join(OUT_DIR, "backend-atlas.html");
  ensureDir(OUT_DIR);

  const mergedKindLabels: Record<string, string> = {};
  let mergedSectionHtml = "";
  let mergedCardRendererJs = "";
  let mergedInitJs = "";
  let mergedStyles = "";

  for (const entry of ctx.siblingPlugins ?? []) {
    if (entry.getAtlasUI) {
      try {
        const uiData = entry.getAtlasUI();
        for (const [key, label] of Object.entries(uiData.kindLabels)) {
          if (key in mergedKindLabels) {
            ui.warn(
              `⚠️  Atlas kindLabel collision: "${key}" (plugin "${entry.name}" overwrites). Use unique namespaced keys.`,
            );
          }
          mergedKindLabels[key] = label;
        }
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
}

export const atlasHtmlCommand = withHelp(ATLAS_HTML_HELP, runAtlasHtml);
