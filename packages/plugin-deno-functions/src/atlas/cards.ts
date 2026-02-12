/**
 * Returns the JavaScript code (as a string) for the renderEdgeFunctionCard() function.
 * This is injected into the Backend Atlas HTML <script> block.
 */
export function edgeFunctionCardRendererJs(): string {
  return `
    function renderEdgeFunctionCard(item) {
      const badges = [];

      // Method badges
      const primaryMethods = (item.methods || []).filter(function(m) { return m !== "OPTIONS"; });
      primaryMethods.forEach(function(m) {
        badges.push('<span class="badge method-' + m.toLowerCase() + '">' + escapeHtml(m) + '</span>');
      });

      // Auth badge
      var authLabel = item.auth_type || "public";
      var authClass = "auth-public";
      if (authLabel === "jwt") { authClass = "auth-jwt"; authLabel = "JWT"; }
      else if (authLabel === "service_role") { authClass = "auth-service-role"; authLabel = "Service Role"; }
      else { authLabel = "Public"; }
      badges.push('<span class="badge ' + authClass + '">' + escapeHtml(authLabel) + '</span>');

      if (item.cors) {
        badges.push('<span class="badge">CORS</span>');
      }

      var search = [
        item.name,
        item.endpoint,
        item.auth_type,
        (item.methods || []).join(" "),
        (item.env_vars || []).join(" "),
        (item.external_apis || []).join(" "),
        (item.db_tables || []).join(" "),
      ].join(" ").toLowerCase();

      // Request fields table
      var reqHtml = "";
      if (item.request_fields && item.request_fields.length) {
        reqHtml = '<div class="detail"><h4>Request Body</h4>' +
          '<table class="ef-field-table"><thead><tr><th>Field</th><th>Type</th></tr></thead><tbody>' +
          item.request_fields.map(function(f) {
            return '<tr><td>' + escapeHtml(f.name) + '</td><td>' + escapeHtml(f.type) + '</td></tr>';
          }).join("") +
          '</tbody></table></div>';
      }

      // Response fields table
      var resHtml = "";
      if (item.response_fields && item.response_fields.length) {
        resHtml = '<div class="detail"><h4>Response</h4>' +
          '<table class="ef-field-table"><thead><tr><th>Field</th><th>Type</th></tr></thead><tbody>' +
          item.response_fields.map(function(f) {
            return '<tr><td>' + escapeHtml(f.name) + '</td><td>' + escapeHtml(f.type) + '</td></tr>';
          }).join("") +
          '</tbody></table></div>';
      }

      // Environment variables
      var envHtml = "";
      if (item.env_vars && item.env_vars.length) {
        envHtml = '<div class="detail"><h4>Environment Variables</h4>' +
          '<div class="ef-tags">' +
          item.env_vars.map(function(v) { return '<span class="ef-tag">' + escapeHtml(v) + '</span>'; }).join("") +
          '</div></div>';
      }

      // External APIs
      var apisHtml = "";
      if (item.external_apis && item.external_apis.length) {
        apisHtml = '<div class="detail"><h4>External APIs</h4>' +
          '<div class="ef-tags">' +
          item.external_apis.map(function(v) { return '<span class="ef-tag">' + escapeHtml(v) + '</span>'; }).join("") +
          '</div></div>';
      }

      // DB Tables
      var tablesHtml = "";
      if (item.db_tables && item.db_tables.length) {
        tablesHtml = '<div class="detail"><h4>Database Tables</h4>' +
          '<div class="ef-tags">' +
          item.db_tables.map(function(v) { return '<span class="ef-tag">' + escapeHtml(v) + '</span>'; }).join("") +
          '</div></div>';
      }

      // Storage buckets
      var bucketsHtml = "";
      if (item.storage_buckets && item.storage_buckets.length) {
        bucketsHtml = '<div class="detail"><h4>Storage Buckets</h4>' +
          '<div class="ef-tags">' +
          item.storage_buckets.map(function(v) { return '<span class="ef-tag">' + escapeHtml(v) + '</span>'; }).join("") +
          '</div></div>';
      }

      // Curl example
      var curlMethod = primaryMethods[0] || "POST";
      var curlBody = "";
      if (item.request_fields && item.request_fields.length && curlMethod !== "GET") {
        var bodyObj = {};
        item.request_fields.forEach(function(f) { bodyObj[f.name] = "..."; });
        curlBody = " \\\\\\n  -d '" + JSON.stringify(bodyObj) + "'";
      }
      var curlAuth = item.auth_type === "public"
        ? '  -H "apikey: YOUR_ANON_KEY"'
        : '  -H "apikey: YOUR_ANON_KEY" \\\\\\n  -H "Authorization: Bearer YOUR_TOKEN"';
      var curlRecipe = "curl -X " + curlMethod + " \\\\\\n  " + escapeHtml(item.endpoint) + " \\\\\\n  " +
        '-H "Content-Type: application/json" \\\\\\n  ' + curlAuth + curlBody;

      // JS SDK example
      var invokeBody = "";
      if (item.request_fields && item.request_fields.length) {
        var bodyFields = item.request_fields.map(function(f) { return "    " + f.name + ": '...'"; }).join(",\\n");
        invokeBody = ", {\\n  body: {\\n" + bodyFields + "\\n  }\\n}";
      }
      var jsRecipe = "const { data, error } = await supabase.functions.invoke('" + item.name + "'" + invokeBody + ");";

      return '<details class="card db-card" data-kind="edge_function" data-schema="" data-search="' + escapeHtml(search) + '">' +
        '<summary>' +
          '<div>' +
            '<div class="card-title">' + escapeHtml(item.name) + '</div>' +
            '<div class="card-sub">' + escapeHtml(item.endpoint) + '</div>' +
          '</div>' +
          '<div class="badge-group">' + badges.join("") + '</div>' +
        '</summary>' +
        '<div class="card-body">' +
          '<div class="detail-grid">' +
            '<div class="detail"><h4>Endpoint</h4><code>' + escapeHtml(item.endpoint) + '</code></div>' +
            '<div class="detail"><h4>Description</h4><code>' + escapeHtml(item.description || "") + '</code></div>' +
            reqHtml + resHtml + envHtml + apisHtml + tablesHtml + bucketsHtml +
          '</div>' +
          '<div class="detail">' +
            '<h4>Curl</h4>' +
            '<pre class="code">' + curlRecipe + '</pre>' +
          '</div>' +
          '<div class="detail">' +
            '<h4>Supabase JS SDK</h4>' +
            '<pre class="code">' + escapeHtml(jsRecipe) + '</pre>' +
          '</div>' +
          '<div class="detail">' +
            '<h4>Source Code</h4>' +
            '<pre class="code">' + escapeHtml(item.source || "") + '</pre>' +
          '</div>' +
        '</div>' +
      '</details>';
    }`;
}
