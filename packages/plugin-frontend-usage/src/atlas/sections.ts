/**
 * HTML section for Frontend Usage in Backend Atlas.
 */
export function frontendUsageSectionHtml(): string {
  return `    <section class="section" id="section-frontend-usage">
      <h2>Frontend Usage</h2>
      <p class="section-sub">Components and their Supabase SDK usage (tables, RPCs, auth, storage, edge functions).</p>
      <div class="frontend-usage-stats" id="frontend-usage-summary"></div>
      <div class="cards" id="frontend-usage-list"></div>
    </section>

`;
}
