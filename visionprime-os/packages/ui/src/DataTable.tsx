import React from "react";
import { LoadingState, EmptyState, ErrorState } from "./states";
import { colors, spacing } from "./tokens";
import { Pagination, PaginationProps } from "./Pagination";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T extends { id: string }> {
  columns: DataTableColumn<T>[];
  rows: T[];
  isLoading?: boolean;
  error?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRetry?: () => void;

  /** Rendered above the header row, e.g. search input / filters. */
  filterSlot?: React.ReactNode;

  /** Rendered when one or more rows are selected. */
  bulkActionsSlot?: React.ReactNode;

  /** Per-row action menu/buttons, rendered in a trailing column. */
  renderRowActions?: (row: T) => React.ReactNode;

  /** Pagination meta — omitted for non-paginated previews. */
  pagination?: PaginationProps;

  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

/**
 * Shared DataTable used by every Admin OS list view — see
 * /docs/ui-ux-guidelines.md. Always receives data via props (the page
 * is responsible for calling the API through `@visionprime/api-client`
 * and passing the result down); this component never fetches data
 * itself.
 */
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  isLoading,
  error,
  emptyTitle = "No records yet.",
  emptyDescription,
  emptyAction,
  onRetry,
  filterSlot,
  bulkActionsSlot,
  renderRowActions,
  pagination,
  selectable,
  selectedIds = [],
  onSelectionChange,
}: DataTableProps<T>) {
  const hasSelection = selectable && selectedIds.length > 0;

  function toggleRow(id: string) {
    if (!onSelectionChange) return;
    onSelectionChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  function toggleAll() {
    if (!onSelectionChange) return;
    onSelectionChange(selectedIds.length === rows.length ? [] : rows.map((row) => row.id));
  }

  return (
    <div>
      {filterSlot}
      {hasSelection ? (
        <div style={{ marginBottom: spacing.md, display: "flex", alignItems: "center", gap: spacing.md }}>
          <span style={{ fontSize: "0.875rem", color: colors.textMuted }}>{selectedIds.length} selected</span>
          {bulkActionsSlot}
        </div>
      ) : null}

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} action={onRetry ? <button onClick={onRetry}>Retry</button> : undefined} />
      ) : rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {selectable ? (
                <th style={{ padding: spacing.sm, borderBottom: `1px solid ${colors.border}` }}>
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={selectedIds.length === rows.length}
                    onChange={toggleAll}
                  />
                </th>
              ) : null}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}`, padding: spacing.sm, fontSize: "0.8rem", color: colors.textMuted }}
                >
                  {col.header}
                </th>
              ))}
              {renderRowActions ? <th style={{ borderBottom: `1px solid ${colors.border}` }} /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-testid="data-table-row">
                {selectable ? (
                  <td style={{ padding: spacing.sm, borderBottom: `1px solid ${colors.surface}` }}>
                    <input
                      type="checkbox"
                      aria-label={`Select row ${row.id}`}
                      checked={selectedIds.includes(row.id)}
                      onChange={() => toggleRow(row.id)}
                    />
                  </td>
                ) : null}
                {columns.map((col) => (
                  <td key={col.key} style={{ borderBottom: `1px solid ${colors.surface}`, padding: spacing.sm, fontSize: "0.875rem" }}>
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
                {renderRowActions ? (
                  <td style={{ borderBottom: `1px solid ${colors.surface}`, padding: spacing.sm, textAlign: "right" }}>
                    {renderRowActions(row)}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pagination && !isLoading && !error && rows.length > 0 ? <Pagination {...pagination} /> : null}
    </div>
  );
}
