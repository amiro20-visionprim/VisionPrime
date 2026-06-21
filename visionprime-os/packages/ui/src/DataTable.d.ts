import React from "react";
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
export declare function DataTable<T extends {
    id: string;
}>({ columns, rows, isLoading, error, emptyLabel, }: DataTableProps<T>): React.JSX.Element;
