/**
 * HTML section stubs for the Query Performance and Service Health
 * sections in Backend Atlas.
 */
export function logsSectionHtml(): string {
  return `    <section class="section" id="section-query-performance">
      <h2>Query Performance</h2>
      <p class="section-sub">Top queries from pg_stat_statements ordered by total execution time.</p>
      <div class="cards" id="query-performance-list"></div>
    </section>

    <section class="section" id="section-service-health">
      <h2>Service Health</h2>
      <p class="section-sub">Docker container status for each Supabase service at atlas generation time.</p>
      <div class="cards" id="service-health-list"></div>
    </section>

`;
}
