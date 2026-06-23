"use client";

import React, { useEffect, useRef, useState } from "react";
import { colors, radius, shadows, spacing, typography } from "./tokens";

export interface DropdownMenuItem {
  key: string;
  label: string;
  onSelect: () => void;
  isDestructive?: boolean;
  isDisabled?: boolean;
}

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
}

/**
 * Shared dropdown menu, typically used for row actions in DataTable.
 * Permission-gating of individual items is the caller's responsibility
 * (wrap items with <Can /> before building this list) — see
 * /docs/permissions.md.
 */
export function DropdownMenu({ trigger, items }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <span onClick={() => setIsOpen((open) => !open)}>{trigger}</span>
      {isOpen ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            marginTop: spacing.xs,
            background: colors.background,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            boxShadow: shadows.md,
            minWidth: 160,
            zIndex: 1200,
            overflow: "hidden",
          }}
        >
          {items.map((item) => (
            <button
              key={item.key}
              role="menuitem"
              type="button"
              disabled={item.isDisabled}
              onClick={() => {
                item.onSelect();
                setIsOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: `${spacing.sm} ${spacing.lg}`,
                fontSize: typography.sizes.sm,
                border: "none",
                background: "none",
                color: item.isDestructive ? colors.danger : colors.text,
                cursor: item.isDisabled ? "not-allowed" : "pointer",
                opacity: item.isDisabled ? 0.5 : 1,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
