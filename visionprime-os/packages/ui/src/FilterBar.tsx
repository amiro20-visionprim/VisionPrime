import React from "react";
import { Input } from "./form/Input";
import { spacing } from "./tokens";

export interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}

/**
 * Shared search + filter + action row placed above a DataTable. Real
 * per-module filters (status, date range, segment, etc.) are passed in
 * via `filters` rather than this component knowing about any module.
 */
export function FilterBar({ searchPlaceholder = "Search...", searchValue, onSearchChange, filters, actions }: FilterBarProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.md, alignItems: "center", marginBottom: spacing.lg }}>
      {onSearchChange ? (
        <div style={{ minWidth: 220 }}>
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search"
          />
        </div>
      ) : null}
      {filters}
      <div style={{ marginLeft: "auto", display: "flex", gap: spacing.sm }}>{actions}</div>
    </div>
  );
}
