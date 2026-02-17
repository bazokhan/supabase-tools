import React from "react";
import { formatValue, getPrimaryKey, prettyLabel, type AtlasRow } from "../lib/model";

interface AppDataTableProps {
  rows: AtlasRow[];
  columns: string[];
  onRowClick?: (row: AtlasRow) => void;
}

export function AppDataTable({ rows, columns, onRowClick }: AppDataTableProps) {
  if (rows.length === 0) {
    return <p className="empty-state">No rows available.</p>;
  }

  return (
    <div className="table-surface">
      <table className="table-grid">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{prettyLabel(column)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getPrimaryKey(row)}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? "table-row-clickable" : ""}
            >
              {columns.map((column) => (
                <td key={column}>
                  {column.includes("sql") || column === "query" ? (
                    <code>{formatValue(row[column])}</code>
                  ) : (
                    formatValue(row[column])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
