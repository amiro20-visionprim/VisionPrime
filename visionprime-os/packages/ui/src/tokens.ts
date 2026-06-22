/**
 * Design tokens shared by every Admin OS / Customer Club component.
 * Components must read from these tokens instead of hardcoding colors,
 * spacing, etc. — see /docs/ui-ux-guidelines.md.
 */

export const colors = {
  background: "#ffffff",
  surface: "#f9fafb",
  border: "#e5e7eb",
  borderStrong: "#d1d5db",
  text: "#111827",
  textMuted: "#6b7280",
  textSubtle: "#9ca3af",

  primary: "#4f46e5",
  primaryHover: "#4338ca",
  primaryText: "#ffffff",

  danger: "#dc2626",
  dangerHover: "#b91c1c",
  dangerSurface: "#fef2f2",

  success: "#16a34a",
  successSurface: "#f0fdf4",

  warning: "#d97706",
  warningSurface: "#fffbeb",

  info: "#2563eb",
  infoSurface: "#eff6ff",

  neutral: "#6b7280",
  neutralSurface: "#f3f4f6",
} as const;

export const statusColors = {
  active: { fg: colors.success, bg: colors.successSurface },
  inactive: { fg: colors.neutral, bg: colors.neutralSurface },
  pending: { fg: colors.warning, bg: colors.warningSurface },
  processing: { fg: colors.info, bg: colors.infoSurface },
  completed: { fg: colors.success, bg: colors.successSurface },
  failed: { fg: colors.danger, bg: colors.dangerSurface },
  cancelled: { fg: colors.neutral, bg: colors.neutralSurface },
  draft: { fg: colors.neutral, bg: colors.neutralSurface },
} as const;

export type StatusKey = keyof typeof statusColors;

export const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  "2xl": "2rem",
  "3xl": "3rem",
} as const;

export const radius = {
  sm: "4px",
  md: "6px",
  lg: "8px",
  xl: "12px",
  full: "9999px",
} as const;

export const typography = {
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  sizes: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.125rem",
    xl: "1.5rem",
    "2xl": "1.875rem",
  },
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

export const shadows = {
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
} as const;

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
} as const;
