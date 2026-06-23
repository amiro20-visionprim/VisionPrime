import React from "react";
import { colors, radius, shadows, spacing, typography } from "./tokens";
import { IconButton } from "./IconButton";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Shared modal. Every Admin OS dialog (forms, confirmations, drawers'
 * desktop fallback) should be built on this rather than a one-off
 * overlay implementation.
 */
export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.background,
          borderRadius: radius.lg,
          boxShadow: shadows.lg,
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
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
          <IconButton aria-label="Close dialog" onClick={onClose}>
            ✕
          </IconButton>
        </div>
        <div style={{ padding: spacing.xl }}>{children}</div>
        {footer ? (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: spacing.sm,
              padding: spacing.xl,
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
