"use client";

import React, { useState } from "react";
import { colors, radius, spacing, typography } from "./tokens";

export interface TooltipProps {
  label: string;
  children: React.ReactNode;
}

export function Tooltip({ label, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible ? (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "125%",
            left: "50%",
            transform: "translateX(-50%)",
            background: colors.text,
            color: "#ffffff",
            padding: `${spacing.xs} ${spacing.sm}`,
            borderRadius: radius.sm,
            fontSize: typography.sizes.xs,
            whiteSpace: "nowrap",
            zIndex: 1500,
          }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
