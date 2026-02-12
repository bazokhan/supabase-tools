/**
 * Returns the section stubs HTML: functions, policies, triggers, views, materialized, types, enums,
 * plus loading and error divs.
 *
 * @param pluginSectionHtml - Optional extra section HTML injected by plugins (appended before loading div).
 */
export function sectionsHtml(pluginSectionHtml: string = ""): string {
  return `    <section class="section" id="section-functions">
      <h2>Functions</h2>
      <p class="section-sub">Stored procedures with call recipes and execution hints.</p>
      <div class="cards" id="functions-list"></div>
    </section>

    <section class="section" id="section-policies">
      <h2>RLS Policies</h2>
      <p class="section-sub">Row-level security rules by table and command.</p>
      <div class="cards" id="policies-list"></div>
    </section>

    <section class="section" id="section-triggers">
      <h2>Triggers</h2>
      <p class="section-sub">Automation hooks running inside the database.</p>
      <div class="cards" id="triggers-list"></div>
    </section>

    <section class="section" id="section-views">
      <h2>Views</h2>
      <p class="section-sub">Projection layers for queries and secure access patterns.</p>
      <div class="cards" id="views-list"></div>
    </section>

    <section class="section" id="section-materialized">
      <h2>Materialized Views</h2>
      <p class="section-sub">Cached query results for analytics and aggregates.</p>
      <div class="cards" id="materialized-views-list"></div>
    </section>

    <section class="section" id="section-types">
      <h2>Types</h2>
      <p class="section-sub">Custom composite and domain types used in the schema.</p>
      <div class="cards" id="types-list"></div>
    </section>

    <section class="section" id="section-enums">
      <h2>Enums</h2>
      <p class="section-sub">Enumerated constants shared across the backend.</p>
      <div class="cards" id="enums-list"></div>
    </section>

${pluginSectionHtml}
    <div class="loading" id="loading">Loading backend snapshot...</div>
    <div class="error" id="error" style="display:none;"></div>
`;
}
