import React from "react";
import { colors, radius, spacing, typography } from "./tokens";

export interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  background?: string;
}

export function Badge({ children, color = colors.text, background = colors.neutralSurface }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `${spacing.xs} ${spacing.sm}`,
        borderRadius: radius.full,
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.medium,
        color,
        background,
      }}
    >
      {children}
    </span>
  );
}
