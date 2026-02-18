import React from "react";

export type ValueFormat = "auto" | "json" | "sql" | "code" | "text";

interface ValueRendererProps {
  value: unknown;
  field?: string;
  format?: ValueFormat;
  compact?: boolean;
}

function inferFormat(value: unknown, field: string): ValueFormat {
  if (field) {
    const f = field.toLowerCase();
    if (f.includes("sql") || f === "query" || f.includes("definition") || f.includes("ddl")) return "sql";
    if (f.includes("json") || f === "resources") return "json";
  }
  return "text";
}

function highlightSql(sql: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|VIEW|INDEX|FUNCTION|TRIGGER|POLICY|TYPE|ENUM|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|ORDER|BY|HAVING|LIMIT|OFFSET|RETURNS|RETURN|AS|AND|OR|NOT|IN|EXISTS|NULL|DEFAULT|PRIMARY|KEY|REFERENCES|FOREIGN|UNIQUE|CHECK|CONSTRAINT|BEGIN|COMMIT|ROLLBACK)\b/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(sql)) !== null) {
    parts.push(sql.slice(lastIndex, match.index));
    parts.push(
      <span key={key++} className="sql-keyword">
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  parts.push(sql.slice(lastIndex));
  return parts;
}

function JsonLeaf({ value }: { value: unknown }): React.ReactNode {
  if (value === null) return <span className="json-null">null</span>;
  if (value === true) return <span className="json-bool">true</span>;
  if (value === false) return <span className="json-bool">false</span>;
  if (typeof value === "number") return <span className="json-number">{value}</span>;
  if (typeof value === "string") {
    const truncated = value.length > 200 ? value.slice(0, 200) + "…" : value;
    const escaped = truncated.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    return <span className="json-string">&quot;{escaped}&quot;</span>;
  }
  return String(value);
}

function JsonArrayNode({ value, depth }: { value: unknown[]; depth: number }) {
  const [open, setOpen] = React.useState(depth < 2);
  return (
    <span className="json-array">
      <button
        type="button"
        className="json-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? "−" : "+"}
      </button>
      [<span className="json-bracket">
        {open ? (
          value.map((item, i) => (
            <div key={i} className="json-indent" style={{ paddingLeft: 12 }}>
              <JsonNode value={item} depth={depth + 1} />,
            </div>
          ))
        ) : (
          <span className="json-ellipsis"> …{value.length} items</span>
        )}
      </span>
      ]
    </span>
  );
}

function JsonObjectNode({ value, depth }: { value: Record<string, unknown>; depth: number }) {
  const [open, setOpen] = React.useState(depth < 2);
  const entries = Object.entries(value);
  return (
    <span className="json-object">
      <button
        type="button"
        className="json-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? "−" : "+"}
      </button>
      {"{"}
      <span className="json-bracket">
        {open ? (
          entries.map(([k, v]) => (
            <div key={k} className="json-indent" style={{ paddingLeft: 12 }}>
              <span className="json-key">&quot;{k.replace(/"/g, "&quot;")}&quot;</span>: <JsonNode value={v} depth={depth + 1} />,
            </div>
          ))
        ) : (
          <span className="json-ellipsis">…{entries.length} keys</span>
        )}
      </span>
      {"}"}
    </span>
  );
}

function JsonNode({ value, depth = 0 }: { value: unknown; depth?: number }): React.ReactNode {
  if (Array.isArray(value)) return <JsonArrayNode value={value} depth={depth} />;
  if (typeof value === "object" && value !== null) return <JsonObjectNode value={value as Record<string, unknown>} depth={depth} />;
  return <JsonLeaf value={value} />;
}

const TRUNCATE_LEN = 80;

export function ValueRenderer({ value, field = "", format = "auto", compact = false }: ValueRendererProps) {
  const resolvedFormat = format === "auto" ? inferFormat(value, field) : format;

  if (value == null) return <span className="value-empty">—</span>;

  if (compact && typeof value === "string" && value.length > TRUNCATE_LEN) {
    return (
      <span className="value-compact" title={value}>
        {value.slice(0, TRUNCATE_LEN)}…
      </span>
    );
  }
  if (compact && typeof value === "object" && value !== null && !Array.isArray(value)) {
    const keys = Object.keys(value as object).length;
    return <span className="value-compact">{"{"}{keys} keys{"}"}</span>;
  }
  if (compact && Array.isArray(value)) {
    const len = value.length;
    return <span className="value-compact">[{len} items]</span>;
  }

  if (resolvedFormat === "json" || (resolvedFormat === "auto" && typeof value === "object")) {
    return (
      <pre className="code-block value-json">
        <JsonNode value={value} />
      </pre>
    );
  }

  const str = typeof value === "object" ? JSON.stringify(value) : String(value);

  if (resolvedFormat === "sql" || (resolvedFormat === "code" && field.toLowerCase().includes("sql"))) {
    return (
      <pre className="code-block value-sql">
        <code>{highlightSql(str)}</code>
      </pre>
    );
  }

  if (resolvedFormat === "code") {
    return (
      <pre className="code-block">
        <code>{str}</code>
      </pre>
    );
  }

  if (Array.isArray(value)) {
    const arr = value as unknown[];
    const strItems = arr.map((v) => (v && typeof v === "object" && "type" in v && "resource" in v
      ? `${(v as { type: string; resource: string }).type}: ${(v as { type: string; resource: string }).resource}`
      : String(v)));
    return <span>{strItems.join(", ")}</span>;
  }

  if (str.length > 160) {
    return (
      <pre className="code-block value-text">
        <code>{str}</code>
      </pre>
    );
  }

  return <span>{str}</span>;
}
