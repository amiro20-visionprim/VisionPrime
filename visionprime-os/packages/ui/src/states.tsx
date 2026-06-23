import React from "react";
import { colors, spacing, typography } from "./tokens";
import { Skeleton } from "./Skeleton";

export function LoadingState({ label = "Loading...", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" style={{ padding: spacing.xl, display: "flex", flexDirection: "column", gap: spacing.sm }}>
      <span style={{ color: colors.textMuted, fontSize: typography.sizes.sm }}>{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} height="1.25rem" />
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding: spacing["2xl"], textAlign: "center", color: colors.textMuted }}>
      <p style={{ fontWeight: typography.weights.medium, color: colors.text }}>{title}</p>
      {description ? <p style={{ fontSize: typography.sizes.sm }}>{description}</p> : null}
      {action ? <div style={{ marginTop: spacing.lg }}>{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong.", action }: { message?: string; action?: React.ReactNode }) {
  return (
    <div role="alert" style={{ padding: spacing["2xl"], textAlign: "center", color: colors.danger }}>
      <p>{message}</p>
      {action ? <div style={{ marginTop: spacing.lg }}>{action}</div> : null}
    </div>
  );
}
