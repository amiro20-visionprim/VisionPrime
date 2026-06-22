import React from "react";
import { colors, radius } from "./tokens";

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ width = "100%", height = "1rem" }: SkeletonProps) {
  return (
    <div
      data-testid="skeleton"
      style={{
        width,
        height,
        borderRadius: radius.sm,
        background: colors.surface,
        animation: "visionprime-skeleton-pulse 1.2s ease-in-out infinite",
      }}
    />
  );
}
