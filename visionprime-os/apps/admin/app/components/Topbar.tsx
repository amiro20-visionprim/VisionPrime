/**
 * Placeholder topbar. Real auth-driven user menu is added once Admin
 * OS auth is implemented (not in Phase 01).
 */
export function Topbar() {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.75rem 1.5rem",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <span style={{ color: "#6b7280" }}>Admin OS</span>
      <span style={{ color: "#6b7280" }}>Signed in as: (placeholder)</span>
    </header>
  );
}
