import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Shared page header per /docs/ui-ux-guidelines.md — every Admin OS
 * page should start with this instead of hand-rolled header markup.
 */
export function PageHeader({ title, description, actions }) {
    return (_jsxs("header", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }, children: [_jsxs("div", { children: [_jsx("h1", { style: { fontSize: "1.5rem", fontWeight: 600, margin: 0 }, children: title }), description ? _jsx("p", { style: { color: "#6b7280", marginTop: "0.25rem" }, children: description }) : null] }), actions ? _jsx("div", { children: actions }) : null] }));
}
