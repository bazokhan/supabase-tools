/**
 * Returns the controls section HTML: search input, schema filter, kind filters container.
 */
export function controlsHtml(): string {
  return `    <section class="controls">
      <input type="text" id="search" placeholder="Search functions, tables, policies, and types" />
      <select id="schema-filter"></select>
      <div class="kind-filters" id="kind-filters"></div>
    </section>

`;
}
