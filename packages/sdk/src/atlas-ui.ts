/**
 * Atlas UI builder — generates PluginAtlasUI from declarative section definitions.
 * Fixes D6 (DRY triad pattern) and C8 (escapeHtml implicit global).
 */
import type { PluginAtlasUI } from "./plugin-api.js";

export interface AtlasSectionDef {
  id: string;
  title: string;
  description: string;
  kind: string;
  kindLabel: string;
  listId: string;
  dataKey: string;
  rendererName: string;
  emptyLabel: string;
  card?: AtlasCardDef;
  summary?: AtlasSummaryDef;
  /** Custom items expression, e.g. "ma && ma.length > 1 ? ma.slice(1) : []" */
  itemsExpr?: string;
  /** Init code before renderSection (e.g. "var ma = data.categories.migration_audit;") */
  initPrefix?: string;
  /** Raw JS card renderer body — replaces generated card when set */
  customCardRendererJs?: string;
}

export interface AtlasCardDef {
  searchFields: string[];
  title: string;
  subtitle: string;
  badges: AtlasBadgeDef[];
  details: AtlasDetailDef[];
}

export interface AtlasBadgeDef {
  label: string;
  cssClass?: string;
  condition?: string;
}

export interface AtlasDetailDef {
  heading: string;
  value: string;
  pre?: boolean;
  condition?: string;
}

export interface AtlasSummaryDef {
  containerId: string;
  containerClass: string;
  rendererName: string;
  customJs: string;
}

function indent(s: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return s
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
}

function emitSectionHtml(s: AtlasSectionDef): string {
  let html = `    <section class="section" id="section-${s.id}">
      <h2>${s.title}</h2>
      <p class="section-sub">${s.description}</p>
`;
  if (s.summary) {
    html += `      <div class="${s.summary.containerClass}" id="${s.summary.containerId}"></div>
`;
  }
  html += `      <div class="cards" id="${s.listId}"></div>
    </section>

`;
  return html;
}

function emitCardRenderer(s: AtlasSectionDef): string {
  if (s.customCardRendererJs) {
    return `    function ${s.rendererName}(item) {
      var esc = escapeHtml;
${indent(s.customCardRendererJs, 6)}
    }
`;
  }
  const card = s.card;
  if (!card) return "";

  const searchExpr = `[${card.searchFields.join(", ")}].join(" ").toLowerCase()`;
  const badgeParts: string[] = [];
  for (const b of card.badges) {
    const cond = b.condition ? `if (${b.condition}) ` : "";
    const cls = b.cssClass ? ` ${b.cssClass}` : "";
    badgeParts.push(`${cond}badges.push('<span class="badge${cls}">' + esc(${b.label}) + '</span>');`);
  }
  const badgeJs = badgeParts.length ? badgeParts.join("\n      ") : "";

  const detailParts: string[] = [];
  for (const d of card.details) {
    const cond = d.condition ? `if (${d.condition}) ` : "";
    const wrap = d.pre ? `<pre class="code">' + esc(${d.value}) + '</pre>` : `<code>' + esc(${d.value}) + '</code>`;
    detailParts.push(`${cond}html += '<div class="detail"><h4>${d.heading}</h4>${wrap}</div>';`);
  }
  const detailJs = detailParts.length ? detailParts.join("\n      ") : "";

  return `    function ${s.rendererName}(item) {
      var esc = escapeHtml;
      var search = ${searchExpr};
      var badges = [];
      ${badgeJs}

      var html = '<details class="card db-card" data-kind="${s.kind}" data-schema="" data-search="' + esc(search) + '">' +
        '<summary><div>' +
          '<div class="card-title">' + esc(${card.title}) + '</div>' +
          '<div class="card-sub">' + esc(${card.subtitle}) + '</div>' +
        '</div><div class="badge-group">' + badges.join("") + '</div></summary>' +
        '<div class="card-body"><div class="detail-grid">';
      ${detailJs}
      html += '</div></div></details>';
      return html;
    }
`;
}

function emitSummaryRenderer(s: AtlasSectionDef): string {
  const sum = s.summary;
  if (!sum) return "";
  return `    function ${sum.rendererName}(data) {
      var esc = escapeHtml;
${indent(sum.customJs, 6)}
    }
`;
}

function emitInitJs(sections: AtlasSectionDef[]): string {
  const lines: string[] = [];
  for (const s of sections) {
    if (s.summary) {
      lines.push(`${s.summary.rendererName}(data);`);
    }
  }
  for (const s of sections) {
    if (s.initPrefix) {
      lines.push(s.initPrefix);
    }
    const itemsExpr = s.itemsExpr ?? `data.categories.${s.dataKey} || []`;
    lines.push(`renderSection("${s.listId}", ${itemsExpr}, ${s.rendererName}, "${s.emptyLabel}");`);
  }
  return lines.join("\n      ");
}

/**
 * Build a PluginAtlasUI from section definitions.
 */
export function buildAtlasUI(
  sections: AtlasSectionDef[],
  extraStyles?: string,
): PluginAtlasUI {
  const kindLabels: Record<string, string> = {};
  let sectionHtml = "";
  let cardRendererJs = "";
  let summaryJs = "";

  for (const s of sections) {
    kindLabels[s.kind] = s.kindLabel;
    sectionHtml += emitSectionHtml(s);
    cardRendererJs += emitCardRenderer(s);
    if (s.summary) {
      summaryJs += emitSummaryRenderer(s);
    }
  }

  const initJs = emitInitJs(sections);

  return {
    kindLabels,
    sectionHtml,
    cardRendererJs: summaryJs + cardRendererJs,
    initJs,
    styles: extraStyles ?? "",
  };
}
