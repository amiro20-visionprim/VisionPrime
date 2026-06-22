import React from "react";
import { colors, spacing, typography } from "./tokens";

export interface TabItem {
  key: string;
  label: string;
}

export interface TabsProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, activeKey, onChange }: TabsProps) {
  return (
    <div role="tablist" style={{ display: "flex", gap: spacing.lg, borderBottom: `1px solid ${colors.border}` }}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            style={{
              background: "none",
              border: "none",
              borderBottom: isActive ? `2px solid ${colors.primary}` : "2px solid transparent",
              padding: `${spacing.sm} ${spacing.xs}`,
              marginBottom: "-1px",
              fontSize: typography.sizes.sm,
              fontWeight: isActive ? typography.weights.semibold : typography.weights.normal,
              color: isActive ? colors.text : colors.textMuted,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
