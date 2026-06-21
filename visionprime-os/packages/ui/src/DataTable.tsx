import React from "react";
import { LoadingState, EmptyState, ErrorState } from "./states";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  isLoading?: boolean;
  error?: string;
  emptyLabel?: string;
}

/**
 * Placeholder shared DataTable per /docs/ui-ux-guidelines.md. Real
 * pagination wiring (matching the API's pagination meta shape) is added
 * once the first paginated list endpoint exists, starting Phase 02.
 */
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  isLoading,
  error,
  emptyLabel = "No records yet.",
}: DataTableProps<T>) {
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (rows.length === 0) return <EmptyState title={emptyLabel} />;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "0.5rem" }}>
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {columns.map((col) => (
              <td key={col.key} style={{ borderBottom: "1px solid #f3f4f6", padding: "0.5rem" }}>
                {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
