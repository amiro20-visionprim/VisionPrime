import React from "react";
import { colors, shadows, spacing, typography } from "./tokens";
import { IconButton } from "./IconButton";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  side?: "right" | "left";
}

export function Drawer({ isOpen, onClose, title, children, side = "right" }: DrawerProps) {
  if (!isOpen) return null;

  return (
    <div role="presentation" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 1000 }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          [side]: 0,
          width: "100%",
          maxWidth: 420,
          background: colors.background,
          boxShadow: shadows.lg,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: spacing.xl,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <h2 style={{ fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, margin: 0 }}>{title}</h2>
          <IconButton aria-label="Close panel" onClick={onClose}>
            ✕
          </IconButton>
        </div>
        <div style={{ padding: spacing.xl, overflowY: "auto", flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}
