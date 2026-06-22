import React from "react";
import { colors, spacing, typography } from "./tokens";

export interface TimelineItem {
  id: string;
  title: React.ReactNode;
  timestamp: string;
  detail?: React.ReactNode;
}

export interface TimelineProps {
  items: TimelineItem[];
  emptyMessage?: string;
}

export function Timeline({ items, emptyMessage = "No events yet." }: TimelineProps) {
  if (items.length === 0) {
    return <div style={{ color: colors.textMuted, fontSize: typography.sizes.sm }}>{emptyMessage}</div>;
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: spacing.lg }}>
      {items.map((item) => (
        <li key={item.id} style={{ display: "flex", gap: spacing.md, alignItems: "flex-start" }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: colors.primary,
              marginTop: "0.4rem",
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.text }}>
              {item.title}
            </div>
            <div style={{ fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: spacing.xs }}>
              {new Date(item.timestamp).toLocaleString()}
            </div>
            {item.detail ? (
              <div style={{ fontSize: typography.sizes.sm, color: colors.textMuted, marginTop: spacing.xs }}>
                {item.detail}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
