import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function LoadingState({ label = "Loading..." }) {
    return _jsx("div", { style: { padding: "2rem", textAlign: "center", color: "#6b7280" }, children: label });
}
export function EmptyState({ title, action }) {
    return (_jsxs("div", { style: { padding: "2rem", textAlign: "center", color: "#6b7280" }, children: [_jsx("p", { children: title }), action] }));
}
export function ErrorState({ message = "Something went wrong." }) {
    return (_jsx("div", { style: { padding: "2rem", textAlign: "center", color: "#b91c1c" }, children: _jsx("p", { children: message }) }));
}
