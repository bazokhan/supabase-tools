import React from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  format?: "text" | "code" | "date" | "bytes" | "ms" | "number";
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  emptyMessage?: string;
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
}

function formatValue(value: unknown, format?: string): string {
  if (value == null) return "—";
  switch (format) {
    case "date":
      return new Date(String(value)).toISOString().replace("T", " ").slice(0, 19);
    case "bytes": {
      const n = Number(value);
      if (n < 1024) return `${n} B`;
      if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
      return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    }
    case "ms":
      return `${Number(value).toFixed(2)} ms`;
    case "number":
      return Number(value).toLocaleString();
    case "code":
      return String(value);
    default:
      return String(value);
  }
}

function getValue<T>(item: T, key: string): unknown {
  const parts = key.split(".");
  let v: unknown = item;
  for (const p of parts) {
    v = (v as Record<string, unknown>)?.[p];
  }
  return v;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  emptyMessage = "No data",
  searchPlaceholder,
  searchFields,
}: DataTableProps<T>) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!query.trim() || !searchFields?.length) return data;
    const q = query.toLowerCase();
    return data.filter((item) =>
      searchFields.some((f) => String(getValue(item, f as string)).toLowerCase().includes(q))
    );
  }, [data, query, searchFields]);

  return (
    <div className="data-table-wrap">
      {searchPlaceholder && searchFields && (
        <input
          type="search"
          className="search-input"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <div className="data-table-surface">
        {filtered.length === 0 ? (
          <p className="data-table-empty">{emptyMessage}</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key}>{col.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={i}>
                  {columns.map((col) => {
                    const val = getValue(item, col.key);
                    const content = col.render
                      ? col.render(item)
                      : col.format === "code"
                        ? <code>{formatValue(val, col.format)}</code>
                        : formatValue(val, col.format);
                    return <td key={col.key}>{content}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
