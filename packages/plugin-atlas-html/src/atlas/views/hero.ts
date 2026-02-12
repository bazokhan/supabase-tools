/**
 * Returns the hero section HTML: eyebrow, title, meta placeholders, actions, stats container.
 */
export function heroHtml(): string {
  return `    <section class="hero">
      <div class="hero-header">
        <div>
          <div class="eyebrow">Backend Snapshot</div>
          <h1>Backend Atlas</h1>
          <p>Visual overview of database functions, RLS policies, and core logic. Generated from the current snapshot.</p>
          <div class="meta-grid">
            <div class="meta-pill">Snapshot: <span id="meta-timestamp">--</span></div>
            <div class="meta-pill">Database: <span id="meta-db">--</span></div>
            <div class="meta-pill">Postgres: <span id="meta-postgres">--</span></div>
          </div>
        </div>
        <div class="hero-actions">
          <button class="button" id="expand-all">Expand All</button>
          <button class="button" id="collapse-all">Collapse All</button>
        </div>
      </div>
      <div class="stats" id="stats"></div>
    </section>

`;
}
