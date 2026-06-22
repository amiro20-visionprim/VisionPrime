import React from "react";
import { Button } from "./Button";
import { colors, spacing, typography } from "./tokens";

export interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Matches the pagination meta shape from /docs/api-conventions.md
 * (`page`, `pageSize`, `totalItems`, `totalPages`).
 */
export function Pagination({ page, pageSize, totalItems, totalPages, onPageChange }: PaginationProps) {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: spacing.lg }}>
      <span style={{ fontSize: typography.sizes.sm, color: colors.textMuted }}>
        Showing {start}-{end} of {totalItems}
      </span>
      <div style={{ display: "flex", gap: spacing.sm }}>
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <span style={{ fontSize: typography.sizes.sm, color: colors.textMuted, alignSelf: "center" }}>
          Page {page} of {totalPages}
        </span>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
