import React from "react";
import { colors, spacing, typography } from "../tokens";

export interface FormFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  htmlFor?: string;
}

/**
 * Shared field wrapper: label + control + hint/error. Real business
 * forms (Phase 03+) compose their fields from this and the input
 * primitives in this package rather than hand-rolling label/error
 * markup per form.
 */
export function FormField({ label, hint, error, required, children, htmlFor }: FormFieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, marginBottom: spacing.lg }}>
      {label ? (
        <label htmlFor={htmlFor} style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.text }}>
          {label}
          {required ? <span style={{ color: colors.danger }}> *</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <span role="alert" style={{ fontSize: typography.sizes.xs, color: colors.danger }}>
          {error}
        </span>
      ) : hint ? (
        <span style={{ fontSize: typography.sizes.xs, color: colors.textMuted }}>{hint}</span>
      ) : null}
    </div>
  );
}
