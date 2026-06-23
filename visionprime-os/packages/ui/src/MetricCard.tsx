import React from "react";
import { Card } from "./Card";
import { colors, spacing, typography } from "./tokens";

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  isLoading?: boolean;
}

const trendColor: Record<NonNullable<MetricCardProps["trend"]>["direction"], string> = {
  up: colors.success,
  down: colors.danger,
  flat: colors.textMuted,
};

export function MetricCard({ label, value, trend, isLoading }: MetricCardProps) {
  return (
    <Card>
      <div style={{ fontSize: typography.sizes.sm, color: colors.textMuted, marginBottom: spacing.sm }}>{label}</div>
      {isLoading ? (
        <div style={{ height: "1.75rem", width: "60%", background: colors.surface, borderRadius: "4px" }} />
      ) : (
        <div style={{ fontSize: typography.sizes["2xl"], fontWeight: typography.weights.semibold, color: colors.text }}>
          {value}
        </div>
      )}
      {trend ? (
        <div style={{ fontSize: typography.sizes.xs, color: trendColor[trend.direction], marginTop: spacing.xs }}>
          {trend.label}
        </div>
      ) : null}
    </Card>
  );
}
