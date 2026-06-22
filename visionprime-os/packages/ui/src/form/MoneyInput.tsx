import React from "react";
import { baseControlStyle, errorControlStyle } from "./controlStyles";
import { colors, spacing, typography } from "../tokens";

export interface MoneyInputProps {
  /** Amount in major currency units (e.g. dollars), not cents. */
  value: number | "";
  onChange: (value: number | "") => void;
  currencySymbol?: string;
  hasError?: boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
  autoFocus?: boolean;
}

/**
 * Numeric input for entering a money amount in major units. Always
 * positive (financial direction is chosen separately by the caller, e.g.
 * a manual-credit vs. manual-debit modal) and constrained to 2 decimal
 * places to match `amount_cents` precision on the server.
 */
export function MoneyInput({
  value,
  onChange,
  currencySymbol = "$",
  hasError,
  disabled,
  placeholder = "0.00",
  id,
  name,
  autoFocus,
}: MoneyInputProps) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <span
        style={{
          position: "absolute",
          left: spacing.md,
          color: colors.textMuted,
          fontSize: typography.sizes.sm,
          pointerEvents: "none",
        }}
      >
        {currencySymbol}
      </span>
      <input
        id={id}
        name={name}
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange("");
            return;
          }
          const parsed = Number(raw);
          onChange(Number.isNaN(parsed) ? "" : parsed);
        }}
        style={{
          ...baseControlStyle,
          ...(hasError ? errorControlStyle : {}),
          paddingLeft: spacing.xl,
        }}
      />
    </div>
  );
}
