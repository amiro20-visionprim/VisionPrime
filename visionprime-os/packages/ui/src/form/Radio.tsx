import React from "react";
import { spacing, typography } from "../tokens";

export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(function Radio({ label, id, ...rest }, ref) {
  const inputId = id ?? `radio-${Math.random().toString(36).slice(2)}`;
  return (
    <label htmlFor={inputId} style={{ display: "inline-flex", alignItems: "center", gap: spacing.sm, fontSize: typography.sizes.sm }}>
      <input ref={ref} id={inputId} type="radio" {...rest} />
      {label}
    </label>
  );
});
