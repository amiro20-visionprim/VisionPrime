import React from "react";
import { Badge } from "./Badge";
import { statusColors, StatusKey, colors } from "./tokens";

export interface StatusBadgeProps {
  status: StatusKey | string;
  label?: string;
}

/**
 * Renders a status with the standard color mapping from
 * /docs/ui-ux-guidelines.md. Unknown statuses fall back to a neutral
 * style rather than throwing, since module-specific statuses are added
 * over time without needing to touch this component.
 */
export function StatusBadge({ status, label }: StatusBadgeProps) {
  const known = statusColors[status as StatusKey];
  const fg = known?.fg ?? colors.neutral;
  const bg = known?.bg ?? colors.neutralSurface;

  return (
    <Badge color={fg} background={bg}>
      {label ?? status}
    </Badge>
  );
}
