import React from "react";
import { Card } from "./Card";
import { colors, spacing, typography } from "./tokens";

export interface ChartCardSeriesPoint {
  label: string;
  value: number;
}

export interface ChartCardProps {
  title: string;
  description?: string;
  data: ChartCardSeriesPoint[];
  isLoading?: boolean;
  /** Bar color; defaults to the design system's primary color. */
  color?: string;
}

/**
 * A minimal dependency-free horizontal bar chart for admin reporting
 * surfaces (campaign reports, analytics) — avoids pulling in a charting
 * library for what's currently a handful of simple distributions.
 */
export function ChartCard({ title, description, data, isLoading, color }: ChartCardProps) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <Card>
      <div style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.text }}>
        {title}
      </div>
      {description ? (
        <div style={{ fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md }}>
          {description}
        </div>
      ) : null}
      {isLoading ? (
        <div style={{ height: "8rem", background: colors.surface, borderRadius: "4px" }} />
      ) : data.length === 0 ? (
        <div style={{ fontSize: typography.sizes.sm, color: colors.textMuted }}>No data yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm, marginTop: spacing.sm }}>
          {data.map((point) => (
            <div key={point.label} style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
              <div style={{ width: "30%", fontSize: typography.sizes.xs, color: colors.textMuted, textAlign: "right" }}>
                {point.label}
              </div>
              <div style={{ flex: 1, background: colors.surface, borderRadius: "4px", overflow: "hidden", height: "0.75rem" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.max(2, (point.value / max) * 100)}%`,
                    background: color ?? colors.primary,
                    borderRadius: "4px",
                  }}
                />
              </div>
              <div style={{ width: "3rem", fontSize: typography.sizes.xs, color: colors.text, fontWeight: typography.weights.medium }}>
                {point.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
