"use client";

import { useRouter } from "next/navigation";
import { Button } from "@visionprime/ui";
import { useAuth } from "../lib/auth-client";

export function Topbar() {
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

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
      {user ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ color: "#374151", fontSize: "0.875rem" }}>
            {user.full_name} {user.is_super_admin ? "(Super Admin)" : ""}
          </span>
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      ) : null}
    </header>
  );
}
