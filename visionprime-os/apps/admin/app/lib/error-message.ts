import { ApiClientError } from "@visionprime/api-client";

/**
 * Friendly, human-readable message derived from the standard error
 * envelope — per /docs/ui-ux-guidelines.md, raw API/network errors are
 * never shown to the admin user.
 */
const FRIENDLY_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Please sign in to continue.",
  AUTH_INVALID_TOKEN: "Your session has expired. Please sign in again.",
  AUTH_INVALID_CREDENTIALS: "Incorrect email or password.",
  PERMISSION_DENIED: "You don't have permission to do that.",
  VALIDATION_FAILED: "Please correct the highlighted fields.",
  NOT_FOUND: "That item could not be found.",
  CANNOT_DELETE_SELF: "You cannot delete your own account.",
  CANNOT_DELETE_SUPER_ADMIN: "You cannot delete a super admin account.",
  CANNOT_REMOVE_CRITICAL_PERMISSION:
    "This change would remove a critical permission you depend on, with no other role granting it to you.",
  CANNOT_MODIFY_SYSTEM_ROLE: "System roles cannot be modified.",
  ROLE_IN_USE: "This role is currently assigned to one or more users.",
  RATE_LIMITED: "Too many requests — please wait a moment and try again.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
};

export function friendlyErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return FRIENDLY_MESSAGES[error.code] ?? error.message ?? "Something went wrong. Please try again.";
  }
  if (error instanceof Error) {
    return "Something went wrong. Please check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}

export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (error instanceof ApiClientError && error.details) {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(error.details)) {
      out[key] = typeof value === "string" ? value : JSON.stringify(value);
    }
    return out;
  }
  return {};
}
