/**
 * Card renderer JS for Frontend Usage Atlas section.
 */
export function frontendUsageCardRendererJs(): string {
  return `
    function renderFrontendUsageCard(item) {
      var esc = typeof escapeHtml === "function" ? escapeHtml : function(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;"); };
      var search = [item.component].concat((item.resources || []).map(function(r) { return r.resource; })).join(" ").toLowerCase();
      var badges = (item.resources || []).slice(0, 8).map(function(r) {
        var typeLabel = r.type === "table" ? "Table" : r.type === "rpc" ? "RPC" : r.type === "auth" ? "Auth" : r.type === "storage" ? "Storage" : r.type === "edge_function" ? "Edge Fn" : r.type;
        return '<span class="badge fw-res" title="' + esc(typeLabel) + '">' + esc(r.resource) + '</span>';
      }).join("");
      var more = (item.resources || []).length > 8 ? '<span class="more">+' + ((item.resources || []).length - 8) + '</span>' : "";
      return '<details class="card db-card" data-kind="frontend_usage" data-search="' + esc(search) + '">' +
        '<summary>' +
          '<div><div class="card-title">' + esc(item.component) + '</div><div class="card-sub">' + (item.hitCount || 0) + ' usages</div></div>' +
          '<div class="badge-group">' + badges + more + '</div>' +
        '</summary>' +
        '<div class="card-body">' +
          '<div class="detail-grid">' +
            '<div class="detail"><h4>Resources</h4>' + (item.resources || []).map(function(r) {
              return '<code>' + esc(r.type + ': ' + r.resource) + '</code>';
            }).join('<br>') + '</div>' +
          '</div>' +
        '</div>' +
      '</details>';
    }`;
}
