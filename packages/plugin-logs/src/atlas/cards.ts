/**
 * Returns the JavaScript code (as a string) for the card renderer functions
 * injected into the Backend Atlas HTML <script> block.
 */
export function logsCardRendererJs(): string {
  return `
    function renderQueryPerfCard(item) {
      var search = [item.query, String(item.calls)].join(" ").toLowerCase();
      var queryShort = item.query.length > 80 ? item.query.substring(0, 80) + "..." : item.query;

      var badges = [];
      badges.push('<span class="badge qp-calls">' + item.calls.toLocaleString() + ' calls</span>');
      if (item.mean_exec_time_ms > 100) {
        badges.push('<span class="badge qp-slow">slow</span>');
      }
      if (item.hit_rate && item.hit_rate !== "n/a") {
        badges.push('<span class="badge">' + escapeHtml(item.hit_rate) + ' cache</span>');
      }

      return '<details class="card db-card" data-kind="query_performance" data-schema="" data-search="' + escapeHtml(search) + '">' +
        '<summary>' +
          '<div>' +
            '<div class="card-title" style="font-family:monospace;font-size:0.82rem;">' + escapeHtml(queryShort) + '</div>' +
            '<div class="card-sub">' +
              'Total: ' + item.total_exec_time_ms.toFixed(2) + 'ms  |  ' +
              'Mean: ' + item.mean_exec_time_ms.toFixed(2) + 'ms  |  ' +
              'Rows: ' + item.rows.toLocaleString() +
            '</div>' +
          '</div>' +
          '<div class="badge-group">' + badges.join("") + '</div>' +
        '</summary>' +
        '<div class="card-body">' +
          '<div class="detail"><h4>Full Query</h4><pre class="code">' + escapeHtml(item.query) + '</pre></div>' +
          '<div class="detail-grid">' +
            '<div class="detail"><h4>Calls</h4><code>' + item.calls.toLocaleString() + '</code></div>' +
            '<div class="detail"><h4>Total Time</h4><code>' + item.total_exec_time_ms.toFixed(2) + ' ms</code></div>' +
            '<div class="detail"><h4>Mean Time</h4><code>' + item.mean_exec_time_ms.toFixed(2) + ' ms</code></div>' +
            '<div class="detail"><h4>Rows Returned</h4><code>' + item.rows.toLocaleString() + '</code></div>' +
            '<div class="detail"><h4>Cache Hit Rate</h4><code>' + escapeHtml(item.hit_rate || "n/a") + '</code></div>' +
          '</div>' +
        '</div>' +
      '</details>';
    }

    function renderServiceHealthCard(item) {
      var search = [item.service, item.container, item.status].join(" ").toLowerCase();
      var statusBadge = item.running
        ? '<span class="badge sh-running">running</span>'
        : '<span class="badge sh-stopped">' + escapeHtml(item.status) + '</span>';

      return '<details class="card db-card" data-kind="service_health" data-schema="" data-search="' + escapeHtml(search) + '">' +
        '<summary>' +
          '<div>' +
            '<div class="card-title">' + escapeHtml(item.service) + '</div>' +
            '<div class="card-sub">' + escapeHtml(item.container) + '</div>' +
          '</div>' +
          '<div class="badge-group">' + statusBadge + '</div>' +
        '</summary>' +
        '<div class="card-body">' +
          '<div class="detail-grid">' +
            '<div class="detail"><h4>Container</h4><code>' + escapeHtml(item.container) + '</code></div>' +
            '<div class="detail"><h4>Status</h4><code>' + escapeHtml(item.status) + '</code></div>' +
          '</div>' +
        '</div>' +
      '</details>';
    }`;
}
