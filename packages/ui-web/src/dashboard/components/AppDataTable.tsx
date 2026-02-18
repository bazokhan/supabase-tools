import React from "react";
import { Badge, inferBadgeTone } from "./Badge";
import { EmptyState } from "./EmptyState";
import { Tooltip } from "./Tooltip";
import { ValueRenderer } from "./ValueRenderer";
import { getSectionIcon } from "../lib/section-icons";
import { getPrimaryKey, prettyLabel, type AtlasRow } from "../lib/model";

export type RenderCellFn = (value: unknown, row: AtlasRow) => React.ReactNode;

const BADGE_COLUMNS = new Set(["status", "type", "volatility", "command", "type_kind", "timing"]);

function shouldUseBadge(column: string, value: unknown): boolean {
  if (value == null) return false;
  if (typeof value !== "string" && typeof value !== "number") return false;
  return BADGE_COLUMNS.has(column.toLowerCase());
}

function compareValues(a: unknown, b: unknown, column: string): number {
  const va = a ?? "";
  const vb = b ?? "";
  if (typeof va === "number" && typeof vb === "number") return va - vb;
  const sa = String(va).toLowerCase();
  const sb = String(vb).toLowerCase();
  const numA = Number(va);
  const numB = Number(vb);
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
  return sa.localeCompare(sb);
}

export interface ColumnMeta {
  label?: string;
  tooltip?: string;
  renderCell?: RenderCellFn;
}

interface AppDataTableProps {
  rows: AtlasRow[];
  columns: string[];
  onRowClick?: (row: AtlasRow) => void;
  pageSize?: number;
  section?: string;
  columnMeta?: Record<string, ColumnMeta>;
}

const DEFAULT_COLUMN_WIDTH = 140;

export function AppDataTable({ rows, columns, onRowClick, pageSize = 50, section, columnMeta }: AppDataTableProps) {
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [page, setPage] = React.useState(0);
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>({});
  const [resizing, setResizing] = React.useState<{ column: string; startX: number; startW: number } | null>(null);

  const getColWidth = (col: string) => columnWidths[col] ?? DEFAULT_COLUMN_WIDTH;

  React.useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const newW = Math.max(60, resizing.startW + delta);
      setColumnWidths((w) => ({ ...w, [resizing.column]: newW }));
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

  const sortedRows = React.useMemo(() => {
    if (!sortColumn || !columns.includes(sortColumn)) return [...rows];
    return [...rows].sort((a, b) => {
      const cmp = compareValues(a[sortColumn], b[sortColumn], sortColumn);
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [rows, sortColumn, sortDirection, columns]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pagedRows = sortedRows.slice(page * pageSize, (page + 1) * pageSize);

  React.useEffect(() => {
    setPage(0);
  }, [sortColumn, sortDirection, rows.length]);

  const handleSort = (column: string) => {
    setSortColumn((prev) => {
      if (prev === column) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      else setSortDirection("asc");
      return column;
    });
  };

  if (rows.length === 0) {
    return <EmptyState title="No rows available" message="Try adjusting filters or refreshing the data." />;
  }

  return (
    <div className="table-surface-wrap">
      <div className="table-surface">
      <table className="table-grid table-resizable">
        <colgroup>
          {columns.map((col) => (
            <col key={col} style={{ width: getColWidth(col), minWidth: 60 }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column, idx) => {
              const SectionIcon = section && idx === 0 ? getSectionIcon(section) : null;
              const meta = columnMeta?.[column];
              const label = meta?.label ?? prettyLabel(column);
              const tooltipContent = meta?.tooltip ?? label;
              return (
                <th
                  key={column}
                  className="table-sortable"
                  style={{ width: getColWidth(column) }}
                  onClick={() => handleSort(column)}
                >
                  <Tooltip content={tooltipContent}>
                    <span className="th-content">
                      {SectionIcon ? <SectionIcon size={12} aria-hidden /> : null}
                      {label}
                      {sortColumn === column ? (
                        <span className="sort-indicator" aria-hidden>{sortDirection === "asc" ? " ↑" : " ↓"}</span>
                      ) : null}
                    </span>
                  </Tooltip>
                  <span
                    className="col-resize-handle"
                    role="separator"
                    aria-label={`Resize ${label} column`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setResizing({ column, startX: e.clientX, startW: getColWidth(column) });
                    }}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {pagedRows.map((row) => (
            <tr
              key={getPrimaryKey(row)}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? "table-row-clickable" : ""}
              aria-label={getPrimaryKey(row)}
            >
              {columns.map((column) => {
                const val = row[column];
                const meta = columnMeta?.[column];
                const customRender = meta?.renderCell;
                if (customRender) {
                  return <td key={column}>{customRender(val, row)}</td>;
                }
                if (shouldUseBadge(column, val)) {
                  const str = String(val ?? "");
                  return (
                    <td key={column}>
                      <Badge tone={inferBadgeTone(str, column)}>{str}</Badge>
                    </td>
                  );
                }
                return (
                  <td key={column}>
                    <ValueRenderer value={val} field={column} format="auto" compact />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {sortedRows.length > pageSize ? (
        <div className="pagination">
          <button
            type="button"
            className="btn"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="Previous page"
          >
            Prev
          </button>
          <span className="pagination-info">
            Page {page + 1} of {totalPages} ({sortedRows.length.toLocaleString()} rows)
          </span>
          <button
            type="button"
            className="btn"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      ) : null}
      </div>
    </div>
  );
}
