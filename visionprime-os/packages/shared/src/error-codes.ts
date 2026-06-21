/**
 * Cross-cutting, stable error codes shared by the API and all clients.
 * Module-specific codes are added in later phases alongside their modules.
 */
export const ERROR_CODES = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  NOT_FOUND: "NOT_FOUND",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_INVALID_TOKEN: "AUTH_INVALID_TOKEN",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
