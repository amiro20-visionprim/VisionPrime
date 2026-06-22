import React from "react";
import { colors, radius, spacing, typography } from "./tokens";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: colors.primary, color: colors.primaryText, border: "1px solid transparent" },
  secondary: { background: colors.background, color: colors.text, border: `1px solid ${colors.borderStrong}` },
  danger: { background: colors.danger, color: "#ffffff", border: "1px solid transparent" },
  ghost: { background: "transparent", color: colors.text, border: "1px solid transparent" },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: `${spacing.xs} ${spacing.md}`, fontSize: typography.sizes.sm },
  md: { padding: `${spacing.sm} ${spacing.lg}`, fontSize: typography.sizes.sm },
};

/**
 * Shared Button — every Admin OS action button must use this instead
 * of one-off styled <button> elements. Use `isLoading` for any action
 * that triggers an async request, so the user always gets feedback and
 * cannot double-submit.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", isLoading = false, disabled, children, style, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? "button"}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      data-loading={isLoading ? "true" : undefined}
      style={{
        fontFamily: typography.fontFamily,
        borderRadius: radius.md,
        fontWeight: typography.weights.medium,
        cursor: disabled || isLoading ? "not-allowed" : "pointer",
        opacity: disabled || isLoading ? 0.7 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: spacing.sm,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...rest}
    >
      {isLoading ? <span data-testid="button-spinner" aria-hidden="true">⏳</span> : null}
      {children}
    </button>
  );
});
