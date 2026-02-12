/**
 * Builds the full inline script by composing all script modules.
 */
import { emitConstants } from "./constants.js";
import { emitHelpers } from "./helpers.js";
import { emitCardRenderers } from "./renderers.js";
import { emitSectionRenderers } from "./filters.js";

export interface ClientScriptOptions {
  pluginKindLabels?: Record<string, string>;
  pluginCardRendererJs?: string;
  pluginInitJs?: string;
}

export function buildClientScript(opts: ClientScriptOptions = {}): string {
  return [
    emitConstants(opts.pluginKindLabels ?? {}),
    emitHelpers(),
    emitCardRenderers(),
    opts.pluginCardRendererJs ?? "",
    emitSectionRenderers(opts.pluginInitJs ?? ""),
    emitBootstrap(),
  ].filter(Boolean).join("\n\n");
}

function emitBootstrap(): string {
  return `    fetch(DATA_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(\`Failed to load \${DATA_URL}\`);
        }
        return response.json();
      })
      .then((data) => init(data))
      .catch((error) => {
        document.getElementById("loading").style.display = "none";
        const errorEl = document.getElementById("error");
        errorEl.textContent = error.message || "Failed to load backend atlas data.";
        errorEl.style.display = "block";
      });`;
}
