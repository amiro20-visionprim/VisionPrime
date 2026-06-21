import React from "react";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";

/**
 * Base authenticated-shell layout placeholder. Wraps any page that
 * lives inside the Admin OS app shell (dashboard, design-system
 * preview, and future module pages). Real auth gating is added once
 * Admin OS auth exists — not in Phase 01.
 */
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex" }}>
      <Sidebar />
      <div style={{ flex: 1 }}>
        <Topbar />
        <main style={{ padding: "1.5rem" }}>{children}</main>
      </div>
    </div>
  );
}
