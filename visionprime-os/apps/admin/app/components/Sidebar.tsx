"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Placeholder sidebar. Real per-module permission gating is added once
 * Admin OS auth exists — every module route is listed here so Phase 02
 * placeholder pages are reachable.
 */
const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Customers", href: "/customers" },
  { label: "Orders", href: "/orders" },
  { label: "Wallet", href: "/wallet" },
  { label: "Loyalty", href: "/loyalty" },
  { label: "Rewards", href: "/rewards" },
  { label: "Segments", href: "/segments" },
  { label: "Campaigns", href: "/campaigns" },
  { label: "Automations", href: "/automations" },
  { label: "Notifications", href: "/notifications" },
  { label: "Finance", href: "/finance" },
  { label: "Reports", href: "/reports" },
  { label: "Intelligence", href: "/intelligence" },
  { label: "WordPress Sync", href: "/wordpress-sync" },
  { label: "Users", href: "/users" },
  { label: "Audit Logs", href: "/audit-logs" },
  { label: "Settings", href: "/settings" },
  { label: "Design System", href: "/design-system" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav style={{ width: 220, borderRight: "1px solid #e5e7eb", padding: "1rem", minHeight: "100vh" }}>
      <div style={{ fontWeight: 700, marginBottom: "1.5rem" }}>VisionPrime OS</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                style={{
                  display: "block",
                  padding: "0.4rem 0.5rem",
                  borderRadius: 6,
                  color: isActive ? "#111827" : "#374151",
                  background: isActive ? "#f3f4f6" : "transparent",
                  fontWeight: isActive ? 600 : 400,
                  textDecoration: "none",
                  fontSize: "0.875rem",
                }}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
