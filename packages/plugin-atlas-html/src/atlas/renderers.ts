/**
 * Emits JS card renderer functions for each entity kind.
 */
export function emitCardRenderers(): string {
  return `    function renderFunctionCard(item) {
      const badges = [];
      if (item.security_definer) badges.push(\`<span class="badge warn">Security definer</span>\`);
      if (item.volatility) badges.push(\`<span class="badge">\${escapeHtml(item.volatility)}</span>\`);
      const returns = item.returns ? \`<div class="detail"><h4>Returns</h4><code>\${escapeHtml(item.returns)}</code></div>\` : "";
      const description = item.description ? \`<div class="detail"><h4>Notes</h4><code>\${escapeHtml(item.description)}</code></div>\` : "";
      const search = \`\${item.schema} \${item.name} \${item.signature} \${item.returns || ""} \${(item.args || []).map((a) => a.name).join(" ")}\`.toLowerCase();

      return \`
        <details class="card db-card" data-kind="function" data-schema="\${escapeHtml(item.schema)}" data-search="\${escapeHtml(search)}">
          <summary>
            <div>
              <div class="card-title">\${escapeHtml(item.name)}</div>
              <div class="card-sub">\${escapeHtml(item.schema)} · \${escapeHtml(item.signature)}</div>
            </div>
            <div class="badge-group">\${badges.join("")}</div>
          </summary>
          <div class="card-body">
            <div class="detail-grid">
              <div class="detail"><h4>Signature</h4><code>\${escapeHtml(item.signature)}</code></div>
              \${returns}
              \${description}
            </div>
            <div class="detail">
              <h4>SQL Recipe</h4>
              <pre class="code">\${escapeHtml(buildSqlRecipe(item))}</pre>
            </div>
            <div class="detail">
              <h4>Supabase RPC</h4>
              <pre class="code">\${escapeHtml(buildRpcRecipe(item))}</pre>
            </div>
            <div class="detail">
              <h4>Definition</h4>
              <pre class="code">\${escapeHtml(item.sql)}</pre>
            </div>
          </div>
        </details>
      \`;
    }

    function renderPolicyCard(item) {
      const badges = [];
      if (item.command) badges.push(\`<span class="badge accent">\${escapeHtml(item.command)}</span>\`);
      if (item.permissive) badges.push(\`<span class="badge">\${escapeHtml(item.permissive)}</span>\`);
      const search = \`\${item.schema} \${item.table} \${item.name} \${item.command} \${item.roles}\`.toLowerCase();

      return \`
        <details class="card db-card" data-kind="policy" data-schema="\${escapeHtml(item.schema)}" data-search="\${escapeHtml(search)}">
          <summary>
            <div>
              <div class="card-title">\${escapeHtml(item.name)}</div>
              <div class="card-sub">\${escapeHtml(item.schema)} · \${escapeHtml(item.table)}</div>
            </div>
            <div class="badge-group">\${badges.join("")}</div>
          </summary>
          <div class="card-body">
            <div class="detail-grid">
              <div class="detail"><h4>Roles</h4><code>\${escapeHtml(item.roles || "PUBLIC")}</code></div>
              \${item.using ? \`<div class="detail"><h4>USING</h4><code>\${escapeHtml(item.using)}</code></div>\` : ""}
              \${item.with_check ? \`<div class="detail"><h4>WITH CHECK</h4><code>\${escapeHtml(item.with_check)}</code></div>\` : ""}
            </div>
            <div class="detail">
              <h4>Definition</h4>
              <pre class="code">\${escapeHtml(item.sql)}</pre>
            </div>
          </div>
        </details>
      \`;
    }

    function renderTriggerCard(item) {
      const badges = [];
      if (item.timing) badges.push(\`<span class="badge">\${escapeHtml(item.timing)}</span>\`);
      if (item.events) badges.push(\`<span class="badge accent">\${escapeHtml(item.events)}</span>\`);
      const search = \`\${item.schema} \${item.table} \${item.name} \${item.events} \${item.function_name}\`.toLowerCase();

      return \`
        <details class="card db-card" data-kind="trigger" data-schema="\${escapeHtml(item.schema)}" data-search="\${escapeHtml(search)}">
          <summary>
            <div>
              <div class="card-title">\${escapeHtml(item.name)}</div>
              <div class="card-sub">\${escapeHtml(item.schema)} · \${escapeHtml(item.table)}</div>
            </div>
            <div class="badge-group">\${badges.join("")}</div>
          </summary>
          <div class="card-body">
            <div class="detail-grid">
              <div class="detail"><h4>Events</h4><code>\${escapeHtml(item.events || "")}</code></div>
              <div class="detail"><h4>Function</h4><code>\${escapeHtml(item.function_name || "")}</code></div>
            </div>
            <div class="detail">
              <h4>Definition</h4>
              <pre class="code">\${escapeHtml(item.sql)}</pre>
            </div>
          </div>
        </details>
      \`;
    }

    function renderViewCard(item) {
      const search = \`\${item.schema} \${item.name}\`.toLowerCase();
      const badge = item.kind === "materialized_view" ? \`<span class="badge good">Materialized</span>\` : "";

      return \`
        <details class="card db-card" data-kind="\${escapeHtml(item.kind)}" data-schema="\${escapeHtml(item.schema)}" data-search="\${escapeHtml(search)}">
          <summary>
            <div>
              <div class="card-title">\${escapeHtml(item.name)}</div>
              <div class="card-sub">\${escapeHtml(item.schema)}</div>
            </div>
            <div class="badge-group">\${badge}</div>
          </summary>
          <div class="card-body">
            <div class="detail">
              <h4>Definition</h4>
              <pre class="code">\${escapeHtml(item.sql)}</pre>
            </div>
          </div>
        </details>
      \`;
    }

    function renderTypeCard(item) {
      const search = \`\${item.schema} \${item.name} \${item.type_kind}\`.toLowerCase();
      const badge = item.type_kind ? \`<span class="badge">\${escapeHtml(item.type_kind)}</span>\` : "";

      return \`
        <details class="card db-card" data-kind="type" data-schema="\${escapeHtml(item.schema)}" data-search="\${escapeHtml(search)}">
          <summary>
            <div>
              <div class="card-title">\${escapeHtml(item.name)}</div>
              <div class="card-sub">\${escapeHtml(item.schema)}</div>
            </div>
            <div class="badge-group">\${badge}</div>
          </summary>
          <div class="card-body">
            <div class="detail">
              <h4>Definition</h4>
              <pre class="code">\${escapeHtml(item.sql)}</pre>
            </div>
          </div>
        </details>
      \`;
    }

    function renderEnumCard(item) {
      const search = \`\${item.schema} \${item.name} \${item.values.join(" ")}\`.toLowerCase();
      const values = item.values.length ? item.values.join(", ") : "";

      return \`
        <details class="card db-card" data-kind="enum" data-schema="\${escapeHtml(item.schema)}" data-search="\${escapeHtml(search)}">
          <summary>
            <div>
              <div class="card-title">\${escapeHtml(item.name)}</div>
              <div class="card-sub">\${escapeHtml(item.schema)}</div>
            </div>
            <div class="badge-group"></div>
          </summary>
          <div class="card-body">
            <div class="detail"><h4>Values</h4><code>\${escapeHtml(values)}</code></div>
            <div class="detail">
              <h4>Definition</h4>
              <pre class="code">\${escapeHtml(item.sql)}</pre>
            </div>
          </div>
        </details>
      \`;
    }`;
}
