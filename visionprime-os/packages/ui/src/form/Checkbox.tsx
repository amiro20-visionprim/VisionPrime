import React from "react";
import { spacing, typography } from "../tokens";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, id, ...rest },
  ref,
) {
  const inputId = id ?? `checkbox-${Math.random().toString(36).slice(2)}`;
  return (
    <label htmlFor={inputId} style={{ display: "inline-flex", alignItems: "center", gap: spacing.sm, fontSize: typography.sizes.sm }}>
      <input ref={ref} id={inputId} type="checkbox" {...rest} />
      {label}
    </label>
  );
});
