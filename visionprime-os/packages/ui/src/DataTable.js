import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { LoadingState, EmptyState, ErrorState } from "./states";
/**
 * Placeholder shared DataTable per /docs/ui-ux-guidelines.md. Real
 * pagination wiring (matching the API's pagination meta shape) is added
 * once the first paginated list endpoint exists, starting Phase 02.
 */
export function DataTable({ columns, rows, isLoading, error, emptyLabel = "No records yet.", }) {
    if (isLoading)
        return _jsx(LoadingState, {});
    if (error)
        return _jsx(ErrorState, { message: error });
    if (rows.length === 0)
        return _jsx(EmptyState, { title: emptyLabel });
    return (_jsxs("table", { style: { width: "100%", borderCollapse: "collapse" }, children: [_jsx("thead", { children: _jsx("tr", { children: columns.map((col) => (_jsx("th", { style: { textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "0.5rem" }, children: col.header }, col.key))) }) }), _jsx("tbody", { children: rows.map((row) => (_jsx("tr", { children: columns.map((col) => (_jsx("td", { style: { borderBottom: "1px solid #f3f4f6", padding: "0.5rem" }, children: col.render ? col.render(row) : String(row[col.key] ?? "") }, col.key))) }, row.id))) })] }));
}
