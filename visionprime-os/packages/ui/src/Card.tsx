import React from "react";
import { colors, radius, shadows, spacing } from "./tokens";

export interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Card({ children, style }: CardProps) {
  return (
    <div
      style={{
        background: colors.background,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
        boxShadow: shadows.sm,
        padding: spacing.xl,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
