/**
 * HTML section stub for the Dependency Graph summary in Backend Atlas.
 */
export function depgraphSectionHtml(): string {
  return `    <section class="section" id="section-dependency-graph">
      <h2>Dependency Graph</h2>
      <p class="section-sub">Relationships between tables, functions, triggers, policies, views, enums, and types.</p>
      <div class="depgraph-summary" id="depgraph-summary"></div>
      <div class="cards" id="depgraph-rel-list"></div>
    </section>

`;
}
