import React from "react";
import { colors, radius } from "../tokens";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

export function Switch({ checked, onChange, disabled, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: "2.5rem",
        height: "1.5rem",
        borderRadius: radius.full,
        border: "none",
        background: checked ? colors.primary : colors.borderStrong,
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background 0.15s ease",
      }}
      {...rest}
    >
      <span
        style={{
          position: "absolute",
          top: "0.15rem",
          left: checked ? "1.15rem" : "0.15rem",
          width: "1.2rem",
          height: "1.2rem",
          borderRadius: radius.full,
          background: "#ffffff",
          transition: "left 0.15s ease",
        }}
      />
    </button>
  );
}
