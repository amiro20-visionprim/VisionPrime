"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@visionprime/ui";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import { useAuth } from "../lib/auth-client";

/**
 * Authenticated-shell layout. Wraps every page that lives inside the
 * Admin OS app shell. Redirects to /login if the session cannot be
 * resolved once the initial auth check finishes.
 */
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <LoadingState label="Loading your session..." />
      </div>
    );
  }

  if (!user) {
    // Redirect is in-flight; render nothing to avoid a flash of
    // protected content.
    return null;
  }

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
