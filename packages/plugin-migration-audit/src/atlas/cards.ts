/**
 * Atlas card renderer JS for Migration Audit section.
 * Injected into the Backend Atlas HTML <script> block.
 */
export function migrationAuditCardRendererJs(): string {
  return `
    function renderMigrationAuditSummary(data) {
      var ma = data.categories.migration_audit;
      if (!ma || !ma.length) return;
      var info = ma[0];

      var container = document.getElementById("migration-audit-summary");
      if (!container) return;

      var html = '<div class="ma-stats">';
      html += '<div class="ma-stat"><span class="ma-stat-value">' + (info.total || 0) + '</span><span class="ma-stat-label">Total</span></div>';
      html += '<div class="ma-stat ma-applied"><span class="ma-stat-value">' + (info.applied || 0) + '</span><span class="ma-stat-label">Applied</span></div>';
      html += '<div class="ma-stat ma-pending"><span class="ma-stat-value">' + (info.pending || 0) + '</span><span class="ma-stat-label">Pending</span></div>';
      html += '<div class="ma-stat ma-missing"><span class="ma-stat-value">' + (info.missing || 0) + '</span><span class="ma-stat-label">Missing</span></div>';
      html += '<div class="ma-stat"><span class="ma-stat-value">' + (info.issues || 0) + '</span><span class="ma-stat-label">Issues</span></div>';
      if (info.db_size) {
        html += '<div class="ma-stat"><span class="ma-stat-value">' + escapeHtml(info.db_size) + '</span><span class="ma-stat-label">DB Size</span></div>';
      }
      html += '</div>';
      html += '<a class="ma-link" href="migration-audit.html" target="_blank">Open full audit report &rarr;</a>';
      container.innerHTML = html;
    }

    function renderMigrationAuditCard(item) {
      var statusClass = 'ma-status-' + (item.status || 'unknown');
      var statusLabel = (item.status || 'unknown').charAt(0).toUpperCase() + (item.status || '').slice(1);
      var search = [item.filename, item.status, item.applied_at || ''].join(" ").toLowerCase();
      var badge = '<span class="badge ma-badge ' + statusClass + '">' + escapeHtml(statusLabel) + '</span>';
      var appliedStr = item.applied_at ? new Date(item.applied_at).toISOString().replace('T', ' ').slice(0, 19) : '-';
      var sizeStr = item.size_bytes != null ? (item.size_bytes + ' B') : '-';

      var detailHref = (item.status !== 'missing') ? ('migration-audit/' + (item.filename || '').replace(/\\.sql$/i, '').replace(/[^a-z0-9_-]/gi, '_') + '.html') : '';
      var titleHtml = detailHref ? '<a href="' + escapeHtml(detailHref) + '" target="_blank">' + escapeHtml(item.filename) + '</a>' : escapeHtml(item.filename);
      return '<details class="card db-card" data-kind="migration_audit" data-search="' + escapeHtml(search) + '">' +
        '<summary>' +
          '<div>' +
            '<div class="card-title">' + titleHtml + '</div>' +
            '<div class="card-sub">Applied: ' + escapeHtml(appliedStr) + ' | Size: ' + escapeHtml(sizeStr) + '</div>' +
          '</div>' +
          '<div class="badge-group">' + badge + '</div>' +
        '</summary>' +
        '<div class="card-body">' +
          '<div class="detail-grid">' +
            '<div class="detail"><h4>Status</h4><code>' + escapeHtml(statusLabel) + '</code></div>' +
            '<div class="detail"><h4>Applied At</h4><code>' + escapeHtml(appliedStr) + '</code></div>' +
            '<div class="detail"><h4>File Size</h4><code>' + escapeHtml(sizeStr) + '</code></div>' +
          '</div>' +
        '</div>' +
      '</details>';
    }`;
}
