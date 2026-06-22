import React from "react";
import { colors, radius } from "./tokens";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  variant?: "ghost" | "danger";
}

/**
 * Shared icon-only button (row action menus, close buttons, etc.).
 * `aria-label` is required since there is no visible text label.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = "ghost", disabled, style, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? "button"}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "2rem",
        height: "2rem",
        borderRadius: radius.md,
        border: "1px solid transparent",
        background: "transparent",
        color: variant === "danger" ? colors.danger : colors.textMuted,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
});
