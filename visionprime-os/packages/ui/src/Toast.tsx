"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { colors, radius, shadows, spacing, typography } from "./tokens";

export type ToastVariant = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantColor: Record<ToastVariant, string> = {
  success: colors.success,
  error: colors.danger,
  info: colors.info,
};

/**
 * Wraps the Admin OS (and Customer Club) app once at the root. Pages
 * call `useToast().showToast(...)` instead of rendering their own
 * one-off toast markup.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((current) => [...current, { id, message, variant }]);
      setTimeout(() => dismissToast(id), 4000);
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <div style={{ position: "fixed", bottom: spacing.xl, right: spacing.xl, display: "flex", flexDirection: "column", gap: spacing.sm, zIndex: 2000 }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            style={{
              background: colors.background,
              border: `1px solid ${colors.border}`,
              borderLeft: `4px solid ${variantColor[toast.variant]}`,
              borderRadius: radius.md,
              boxShadow: shadows.md,
              padding: spacing.lg,
              fontSize: typography.sizes.sm,
              minWidth: 240,
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
