/**
 * Placeholder sidebar. Real navigation items are added per module as
 * each module ships (Customer 360 in Phase 02, Orders in Phase 03, etc.)
 */
export function Sidebar() {
  const items = ["Dashboard", "Customers", "Orders", "Wallet", "Loyalty", "Segments", "Campaigns", "Reports"];

  return (
    <nav style={{ width: 220, borderRight: "1px solid #e5e7eb", padding: "1rem", minHeight: "100vh" }}>
      <div style={{ fontWeight: 700, marginBottom: "1.5rem" }}>VisionPrime OS</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {items.map((item) => (
          <li key={item} style={{ color: "#374151" }}>
            {item}
          </li>
        ))}
      </ul>
    </nav>
  );
}
