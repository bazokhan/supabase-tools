import React from "react";
import { Badge, inferBadgeTone } from "./Badge";
import { EmptyState } from "./EmptyState";
import { Tooltip } from "./Tooltip";
import { ValueRenderer } from "./ValueRenderer";

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
  pageSize?: number;
}

const BADGE_COLUMNS = new Set(["status", "type", "volatility", "command", "type_kind"]);

function mapFormatToValueRenderer(colFormat?: string): "auto" | "json" | "sql" | "code" | "text" {
  if (colFormat === "code") return "code";
  return "auto";
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
  pageSize = 50,
}: DataTableProps<T>) {
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [page, setPage] = React.useState(0);
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>({});
  const [resizing, setResizing] = React.useState<{ key: string; startX: number; startW: number } | null>(null);

  const DEFAULT_COL_WIDTH = 140;
  const getColWidth = (key: string) => columnWidths[key] ?? DEFAULT_COL_WIDTH;

  React.useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const newW = Math.max(60, resizing.startW + delta);
      setColumnWidths((w) => ({ ...w, [resizing.key]: newW }));
    };
    const onUp = () => setResizing(null);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizing]);

  const filtered = React.useMemo(() => {
    if (!query.trim() || !searchFields?.length) return data;
    const q = query.toLowerCase();
    return data.filter((item) =>
      searchFields.some((f) => String(getValue(item, f as string)).toLowerCase().includes(q))
    );
  }, [data, query, searchFields]);

  function compare(a: T, b: T, key: string): number {
    const va = getValue(a, key);
    const vb = getValue(b, key);
    if (typeof va === "number" && typeof vb === "number") return va - vb;
    const sa = String(va ?? "").toLowerCase();
    const sb = String(vb ?? "").toLowerCase();
    const numA = Number(va);
    const numB = Number(vb);
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
    return sa.localeCompare(sb);
  }

  const sorted = React.useMemo(() => {
    if (!sortKey || !columns.some((c) => c.key === sortKey)) return filtered;
    return [...filtered].sort((a, b) => {
      const cmp = compare(a, b, sortKey);
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDirection, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  React.useEffect(() => {
    setPage(0);
  }, [sortKey, sortDirection, filtered.length]);

  const handleSort = (key: string) => {
    setSortKey((prev) => {
      if (prev === key) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      else setSortDirection("asc");
      return key;
    });
  };

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
      <div className="data-table-surface-wrap">
      <div className="data-table-surface">
        {filtered.length === 0 ? (
          <EmptyState title={emptyMessage} />
        ) : (
          <>
          <table className="data-table table-resizable">
            <colgroup>
              {columns.map((col) => (
                <col key={col.key} style={{ width: getColWidth(col.key), minWidth: 60 }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="table-sortable"
                    style={{ width: getColWidth(col.key) }}
                    onClick={() => handleSort(col.key)}
                  >
                    <Tooltip content={col.header}>
                      <span>
                        {col.header}
                        {sortKey === col.key ? (
                          <span className="sort-indicator" aria-hidden>{sortDirection === "asc" ? " ↑" : " ↓"}</span>
                        ) : null}
                      </span>
                    </Tooltip>
                    <span
                      className="col-resize-handle"
                      role="separator"
                      aria-label={`Resize ${col.header} column`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setResizing({ key: col.key, startX: e.clientX, startW: getColWidth(col.key) });
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((item, i) => (
                <tr key={i}>
                  {columns.map((col) => {
                    const val = getValue(item, col.key);
                    if (col.render) {
                      return <td key={col.key}>{col.render(item)}</td>;
                    }
                    if (BADGE_COLUMNS.has(col.key.toLowerCase()) && val != null) {
                      const str = String(val);
                      return (
                        <td key={col.key}>
                          <Badge tone={inferBadgeTone(str, col.key)}>{str}</Badge>
                        </td>
                      );
                    }
                    if (col.format === "date" || col.format === "bytes" || col.format === "ms" || col.format === "number") {
                      return <td key={col.key}>{formatValue(val, col.format)}</td>;
                    }
                    return (
                      <td key={col.key}>
                        <ValueRenderer value={val} field={col.key} format={mapFormatToValueRenderer(col.format)} compact />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length > pageSize ? (
            <div className="pagination">
              <button type="button" className="btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} aria-label="Previous page">
                Prev
              </button>
              <span className="pagination-info">
                Page {page + 1} of {totalPages} ({sorted.length.toLocaleString()} rows)
              </span>
              <button type="button" className="btn" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} aria-label="Next page">
                Next
              </button>
            </div>
          ) : null}
        </>
        )}
      </div>
      </div>
    </div>
  );
}
