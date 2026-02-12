/**
 * Emits shared JS helper functions: escapeHtml, formatDate, placeholder generators, recipe builders.
 */
export function emitHelpers(): string {
  return `    function escapeHtml(value) {
      return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function formatDate(value) {
      if (!value) return "--";
      const date = new Date(value);
      return date.toLocaleString();
    }

    function placeholderFor(type) {
      const t = (type || "").toLowerCase();
      if (t.includes("uuid")) return "'00000000-0000-0000-0000-000000000000'";
      if (t.includes("bool")) return "true";
      if (t.includes("int") || t.includes("numeric") || t.includes("double") || t.includes("real")) return "0";
      if (t.includes("json")) return "'{}'::jsonb";
      if (t.includes("timestamp") || t.includes("date") || t.includes("time")) return "now()";
      if (t.includes("text") || t.includes("char")) return "'...'";
      return "null";
    }

    function placeholderForJs(type) {
      const t = (type || "").toLowerCase();
      if (t.includes("uuid")) return "'00000000-0000-0000-0000-000000000000'";
      if (t.includes("bool")) return "true";
      if (t.includes("int") || t.includes("numeric") || t.includes("double") || t.includes("real")) return "0";
      if (t.includes("json")) return "{}";
      if (t.includes("timestamp") || t.includes("date") || t.includes("time")) return "new Date().toISOString()";
      if (t.includes("text") || t.includes("char")) return "'...'";
      return "null";
    }

    function toJsKey(name) {
      if (/^[A-Za-z_$][\\w$]*$/.test(name)) {
        return name;
      }
      return JSON.stringify(name);
    }

    function buildSqlRecipe(item) {
      if (!item.args || !item.args.length) {
        return \`select * from \${item.schema}.\${item.name}();\`;
      }
      const lines = item.args.map((arg) => \`  \${arg.name} => \${placeholderFor(arg.type)}\`);
      return \`select * from \${item.schema}.\${item.name}(\\n\${lines.join(",\\n")}\\n);\`;
    }

    function buildRpcRecipe(item) {
      if (!item.args || !item.args.length) {
        return \`const { data, error } = await supabase.rpc('\${item.name}');\`;
      }
      const lines = item.args.map((arg) => \`  \${toJsKey(arg.name)}: \${placeholderForJs(arg.type)}\`);
      return \`const { data, error } = await supabase.rpc('\${item.name}', {\\n\${lines.join(",\\n")}\\n});\`;
    }`;
}
