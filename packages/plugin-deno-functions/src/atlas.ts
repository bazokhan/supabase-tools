/**
 * Atlas UI contributions for plugin-deno-functions — Edge Functions section.
 */
import { buildAtlasUI, type AtlasSectionDef } from "@sbtools/sdk";
import { edgeFunctionStyles } from "./atlas/styles.js";

const EDGE_FUNCTION_CARD_JS = `
      const badges = [];
      const primaryMethods = (item.methods || []).filter(function(m) { return m !== "OPTIONS"; });
      primaryMethods.forEach(function(m) {
        badges.push('<span class="badge method-' + m.toLowerCase() + '">' + esc(m) + '</span>');
      });
      var authLabel = item.auth_type || "public";
      var authClass = "auth-public";
      if (authLabel === "jwt") { authClass = "auth-jwt"; authLabel = "JWT"; }
      else if (authLabel === "service_role") { authClass = "auth-service-role"; authLabel = "Service Role"; }
      else { authLabel = "Public"; }
      badges.push('<span class="badge ' + authClass + '">' + esc(authLabel) + '</span>');
      if (item.cors) { badges.push('<span class="badge">CORS</span>'); }
      var search = [item.name, item.endpoint, item.auth_type, (item.methods || []).join(" "), (item.env_vars || []).join(" "), (item.external_apis || []).join(" "), (item.db_tables || []).join(" ")].join(" ").toLowerCase();
      var reqHtml = "";
      if (item.request_fields && item.request_fields.length) {
        reqHtml = '<div class="detail"><h4>Request Body</h4><table class="ef-field-table"><thead><tr><th>Field</th><th>Type</th></tr></thead><tbody>' +
          item.request_fields.map(function(f) { return '<tr><td>' + esc(f.name) + '</td><td>' + esc(f.type) + '</td></tr>'; }).join("") + '</tbody></table></div>';
      }
      var resHtml = "";
      if (item.response_fields && item.response_fields.length) {
        resHtml = '<div class="detail"><h4>Response</h4><table class="ef-field-table"><thead><tr><th>Field</th><th>Type</th></tr></thead><tbody>' +
          item.response_fields.map(function(f) { return '<tr><td>' + esc(f.name) + '</td><td>' + esc(f.type) + '</td></tr>'; }).join("") + '</tbody></table></div>';
      }
      var envHtml = "";
      if (item.env_vars && item.env_vars.length) {
        envHtml = '<div class="detail"><h4>Environment Variables</h4><div class="ef-tags">' +
          item.env_vars.map(function(v) { return '<span class="ef-tag">' + esc(v) + '</span>'; }).join("") + '</div></div>';
      }
      var apisHtml = "";
      if (item.external_apis && item.external_apis.length) {
        apisHtml = '<div class="detail"><h4>External APIs</h4><div class="ef-tags">' +
          item.external_apis.map(function(v) { return '<span class="ef-tag">' + esc(v) + '</span>'; }).join("") + '</div></div>';
      }
      var tablesHtml = "";
      if (item.db_tables && item.db_tables.length) {
        tablesHtml = '<div class="detail"><h4>Database Tables</h4><div class="ef-tags">' +
          item.db_tables.map(function(v) { return '<span class="ef-tag">' + esc(v) + '</span>'; }).join("") + '</div></div>';
      }
      var bucketsHtml = "";
      if (item.storage_buckets && item.storage_buckets.length) {
        bucketsHtml = '<div class="detail"><h4>Storage Buckets</h4><div class="ef-tags">' +
          item.storage_buckets.map(function(v) { return '<span class="ef-tag">' + esc(v) + '</span>'; }).join("") + '</div></div>';
      }
      var curlMethod = primaryMethods[0] || "POST";
      var curlBody = "";
      if (item.request_fields && item.request_fields.length && curlMethod !== "GET") {
        var bodyObj = {};
        item.request_fields.forEach(function(f) { bodyObj[f.name] = "..."; });
        curlBody = " \\\\\\n  -d '" + JSON.stringify(bodyObj) + "'";
      }
      var curlAuth = item.auth_type === "public" ? '  -H "apikey: YOUR_ANON_KEY"' : '  -H "apikey: YOUR_ANON_KEY" \\\\\\n  -H "Authorization: Bearer YOUR_TOKEN"';
      var curlRecipe = "curl -X " + curlMethod + " \\\\\\n  " + esc(item.endpoint) + " \\\\\\n  " + '-H "Content-Type: application/json" \\\\\\n  ' + curlAuth + curlBody;
      var invokeBody = "";
      if (item.request_fields && item.request_fields.length) {
        var bodyFields = item.request_fields.map(function(f) { return "    " + f.name + ": '...'"; }).join(",\\\\n");
        invokeBody = ", {\\\\n  body: {\\\\n" + bodyFields + "\\\\n  }\\\\n}";
      }
      var jsRecipe = "const { data, error } = await supabase.functions.invoke('" + item.name + "'" + invokeBody + ");";
      return '<details class="card db-card" data-kind="edge_function" data-schema="" data-search="' + esc(search) + '">' +
        '<summary><div><div class="card-title">' + esc(item.name) + '</div><div class="card-sub">' + esc(item.endpoint) + '</div></div><div class="badge-group">' + badges.join("") + '</div></summary>' +
        '<div class="card-body"><div class="detail-grid">' +
        '<div class="detail"><h4>Endpoint</h4><code>' + esc(item.endpoint) + '</code></div>' +
        '<div class="detail"><h4>Description</h4><code>' + esc(item.description || "") + '</code></div>' +
        reqHtml + resHtml + envHtml + apisHtml + tablesHtml + bucketsHtml +
        '</div><div class="detail"><h4>Curl</h4><pre class="code">' + curlRecipe + '</pre></div>' +
        '<div class="detail"><h4>Supabase JS SDK</h4><pre class="code">' + esc(jsRecipe) + '</pre></div>' +
        '<div class="detail"><h4>Source Code</h4><pre class="code">' + esc(item.source || "") + '</pre></div></div></details>';
`;

const sections: AtlasSectionDef[] = [
  {
    id: "edge-functions",
    title: "Edge Functions",
    description:
      "Serverless Deno functions invoked via HTTP. Includes endpoint, auth, request/response schemas, and usage recipes.",
    kind: "edge_function",
    kindLabel: "Edge Functions",
    listId: "edge-functions-list",
    dataKey: "edge_functions",
    rendererName: "renderEdgeFunctionCard",
    emptyLabel: "edge functions",
    customCardRendererJs: EDGE_FUNCTION_CARD_JS.trim(),
  },
];

export function getEdgeFunctionAtlasUI() {
  return buildAtlasUI(sections, edgeFunctionStyles());
}
