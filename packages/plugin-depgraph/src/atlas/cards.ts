/**
 * Card renderer JS for the Dependency Graph Atlas section.
 * Injected into the Backend Atlas HTML <script> block.
 */
export function depgraphCardRendererJs(): string {
  return `
    function renderDepgraphSummary(data) {
      var dg = data.categories.dependency_graph;
      if (!dg || !dg.length) return;
      var info = dg[0]; // single summary object

      var container = document.getElementById("depgraph-summary");
      if (!container) return;

      var html = '<div class="depgraph-stats">';
      html += '<div class="depgraph-stat"><span class="depgraph-stat-value">' + (info.total_nodes || 0) + '</span><span class="depgraph-stat-label">Nodes</span></div>';
      html += '<div class="depgraph-stat"><span class="depgraph-stat-value">' + (info.total_edges || 0) + '</span><span class="depgraph-stat-label">Edges</span></div>';

      if (info.relationship_counts) {
        var keys = Object.keys(info.relationship_counts);
        for (var i = 0; i < keys.length; i++) {
          html += '<div class="depgraph-stat"><span class="depgraph-stat-value">' + info.relationship_counts[keys[i]] + '</span><span class="depgraph-stat-label">' + escapeHtml(keys[i]) + '</span></div>';
        }
      }

      html += '</div>';
      html += '<a class="depgraph-link" href="dependency-graph.html" target="_blank">Open interactive graph &rarr;</a>';
      container.innerHTML = html;
    }

    function renderDepgraphRelCard(item) {
      var search = [item.source_label, item.target_label, item.label].join(" ").toLowerCase();
      var typeBadge = '<span class="badge dg-rel">' + escapeHtml(item.label) + '</span>';

      return '<details class="card db-card" data-kind="dependency_graph" data-schema="" data-search="' + escapeHtml(search) + '">' +
        '<summary>' +
          '<div>' +
            '<div class="card-title">' + escapeHtml(item.source_label) + ' &rarr; ' + escapeHtml(item.target_label) + '</div>' +
            '<div class="card-sub">' + escapeHtml(item.source_type) + ' &rarr; ' + escapeHtml(item.target_type) + '</div>' +
          '</div>' +
          '<div class="badge-group">' + typeBadge + '</div>' +
        '</summary>' +
        '<div class="card-body">' +
          '<div class="detail-grid">' +
            '<div class="detail"><h4>Source</h4><code>' + escapeHtml(item.source_id) + '</code></div>' +
            '<div class="detail"><h4>Target</h4><code>' + escapeHtml(item.target_id) + '</code></div>' +
            '<div class="detail"><h4>Relationship</h4><code>' + escapeHtml(item.label) + '</code></div>' +
          '</div>' +
        '</div>' +
      '</details>';
    }`;
}
