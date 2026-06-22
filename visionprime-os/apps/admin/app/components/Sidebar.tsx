"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Can } from "@visionprime/ui";
import { useAuth } from "../lib/auth-client";

interface NavItem {
  label: string;
  href: string;
  /** Permission key gating visibility; omitted = always visible. */
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Customers", href: "/customers", permission: "customer:view" },
  { label: "Products", href: "/products", permission: "product:view" },
  { label: "Orders", href: "/orders", permission: "order:view" },
  { label: "Wallet", href: "/wallet", permission: "wallet:view" },
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
  { label: "Users", href: "/users", permission: "user:view" },
  { label: "Roles", href: "/roles", permission: "role:view" },
  { label: "Permissions", href: "/permissions", permission: "permission:view" },
  { label: "Audit Logs", href: "/audit-logs", permission: "audit:view" },
  { label: "Activity Logs", href: "/activity-logs", permission: "audit:view" },
  { label: "Security Events", href: "/security-events", permission: "security_event:view" },
  { label: "Settings", href: "/settings", permission: "settings:view" },
  { label: "Design System", href: "/design-system" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { permissions, isSuperAdmin } = useAuth();
  const userPermissions = isSuperAdmin ? undefined : permissions;

  return (
    <nav style={{ width: 220, borderRight: "1px solid #e5e7eb", padding: "1rem", minHeight: "100vh" }}>
      <div style={{ fontWeight: 700, marginBottom: "1.5rem" }}>VisionPrime OS</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const link = (
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
          );

          if (!item.permission) {
            return <li key={item.href}>{link}</li>;
          }

          return (
            <li key={item.href}>
              <Can permission={item.permission} userPermissions={userPermissions}>
                {link}
              </Can>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
