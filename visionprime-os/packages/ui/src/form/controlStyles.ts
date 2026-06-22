import { colors, radius, spacing, typography } from "../tokens";

/**
 * Shared base style for text-like inputs (Input, Textarea, Select) so
 * every form control looks consistent without each component
 * re-declaring the same CSS.
 */
export const baseControlStyle = {
  width: "100%",
  fontFamily: typography.fontFamily,
  fontSize: typography.sizes.sm,
  padding: `${spacing.sm} ${spacing.md}`,
  borderRadius: radius.md,
  border: `1px solid ${colors.borderStrong}`,
  background: colors.background,
  color: colors.text,
} as const;

export const errorControlStyle = {
  borderColor: colors.danger,
} as const;
