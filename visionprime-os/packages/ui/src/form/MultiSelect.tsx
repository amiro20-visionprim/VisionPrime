import React from "react";
import { colors, radius, spacing, typography } from "../tokens";
import { SelectOption } from "./Select";

export interface MultiSelectProps {
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Minimal checkbox-list based multi-select. Phase 02 placeholder — a
 * richer searchable variant can replace the internals later without
 * changing the prop contract used by forms.
 */
export function MultiSelect({ options, value, onChange, placeholder, disabled }: MultiSelectProps) {
  function toggle(optionValue: string) {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  }

  return (
    <div
      style={{
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radius.md,
        padding: spacing.sm,
        display: "flex",
        flexDirection: "column",
        gap: spacing.xs,
      }}
    >
      {options.length === 0 ? (
        <span style={{ fontSize: typography.sizes.sm, color: colors.textMuted }}>{placeholder ?? "No options"}</span>
      ) : (
        options.map((option) => (
          <label key={option.value} style={{ display: "flex", alignItems: "center", gap: spacing.sm, fontSize: typography.sizes.sm }}>
            <input
              type="checkbox"
              checked={value.includes(option.value)}
              disabled={disabled}
              onChange={() => toggle(option.value)}
            />
            {option.label}
          </label>
        ))
      )}
    </div>
  );
}
