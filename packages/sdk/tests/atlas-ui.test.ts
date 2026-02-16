import { describe, it, expect } from "vitest";
import {
  buildAtlasUI,
  type AtlasSectionDef,
  type AtlasCardDef,
  type AtlasBadgeDef,
  type AtlasDetailDef,
} from "../src/atlas-ui.js";

describe("buildAtlasUI", () => {
  it("returns empty PluginAtlasUI for no sections", () => {
    const result = buildAtlasUI([]);
    expect(result.kindLabels).toEqual({});
    expect(result.sectionHtml).toBe("");
    expect(result.cardRendererJs).toBe("");
    expect(result.initJs).toBe("");
    expect(result.styles).toBe("");
  });

  it("generates section HTML with title and description", () => {
    const sections: AtlasSectionDef[] = [
      {
        id: "test-section",
        title: "Test Section",
        description: "Test description.",
        kind: "test_kind",
        kindLabel: "Test Kind",
        listId: "test-list",
        dataKey: "test_data",
        rendererName: "renderTestCard",
        emptyLabel: "items",
        card: {
          searchFields: ["item.name"],
          title: "item.name",
          subtitle: "item.id",
          badges: [],
          details: [],
        },
      },
    ];
    const result = buildAtlasUI(sections);
    expect(result.kindLabels).toEqual({ test_kind: "Test Kind" });
    expect(result.sectionHtml).toContain('id="section-test-section"');
    expect(result.sectionHtml).toContain("<h2>Test Section</h2>");
    expect(result.sectionHtml).toContain("Test description.");
    expect(result.sectionHtml).toContain('id="test-list"');
  });

  it("generates card renderer with esc alias (fixes C8)", () => {
    const sections: AtlasSectionDef[] = [
      {
        id: "x",
        title: "X",
        description: "Y",
        kind: "x",
        kindLabel: "X",
        listId: "x-list",
        dataKey: "x",
        rendererName: "renderXCard",
        emptyLabel: "x",
        card: {
          searchFields: ["item.name"],
          title: "item.name",
          subtitle: "''",
          badges: [{ label: "item.status" }],
          details: [{ heading: "ID", value: "item.id" }],
        },
      },
    ];
    const result = buildAtlasUI(sections);
    expect(result.cardRendererJs).toContain("var esc = escapeHtml");
    expect(result.cardRendererJs).toContain("function renderXCard(item)");
  });

  it("generates init JS with renderSection calls", () => {
    const sections: AtlasSectionDef[] = [
      {
        id: "a",
        title: "A",
        description: "A desc",
        kind: "a",
        kindLabel: "A",
        listId: "a-list",
        dataKey: "a",
        rendererName: "renderA",
        emptyLabel: "a items",
      },
    ];
    const result = buildAtlasUI(sections);
    expect(result.initJs).toContain('renderSection("a-list"');
    expect(result.initJs).toContain("data.categories.a || []");
  });

  it("passes through extraStyles", () => {
    const css = ".foo { color: red; }";
    const result = buildAtlasUI([], css);
    expect(result.styles).toBe(css);
  });

  it("generates summary block when summary is defined", () => {
    const sections: AtlasSectionDef[] = [
      {
        id: "s",
        title: "S",
        description: "S desc",
        kind: "s",
        kindLabel: "S",
        listId: "s-list",
        dataKey: "s",
        rendererName: "renderSCard",
        emptyLabel: "s",
        summary: {
          containerId: "s-summary",
          containerClass: "s-stats",
          rendererName: "renderSSummary",
          customJs: "var el = document.getElementById('s-summary'); if (el) el.innerHTML = 'ok';",
        },
      },
    ];
    const result = buildAtlasUI(sections);
    expect(result.sectionHtml).toContain('id="s-summary"');
    expect(result.sectionHtml).toContain('class="s-stats"');
    expect(result.cardRendererJs).toContain("function renderSSummary(data)");
    expect(result.initJs).toContain("renderSSummary(data)");
  });

  it("uses customCardRendererJs when provided", () => {
    const customBody = "return '<span>' + escapeHtml(item.x) + '</span>';";
    const sections: AtlasSectionDef[] = [
      {
        id: "c",
        title: "C",
        description: "C desc",
        kind: "c",
        kindLabel: "C",
        listId: "c-list",
        dataKey: "c",
        rendererName: "renderCCard",
        emptyLabel: "c",
        customCardRendererJs: customBody,
      },
    ];
    const result = buildAtlasUI(sections);
    expect(result.cardRendererJs).toContain(customBody);
    expect(result.cardRendererJs).toContain("function renderCCard(item)");
  });
});
