/**
 * HTML section stub for Migration Audit in Backend Atlas.
 */
export function migrationAuditSectionHtml(): string {
  return `    <section class="section" id="section-migration-audit">
      <h2>Migration Audit</h2>
      <p class="section-sub">Migration file vs database tracking comparison. Detects drift and consistency issues.</p>
      <div class="migration-audit-summary" id="migration-audit-summary"></div>
      <div class="cards" id="migration-audit-list"></div>
    </section>

`;
}
