import { z, ZodError, ZodSchema } from "zod";

export { z };

/**
 * Shared validation entry point. Backend endpoints and frontend forms
 * both validate against the same ZodSchema definitions defined per
 * module (added starting Phase 02) — this package only provides the
 * common helper used to run that validation consistently.
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  fieldErrors?: Record<string, string>;
}

export function validate<T>(schema: ZodSchema<T>, input: unknown): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, fieldErrors: flattenZodError(result.error) };
}

function flattenZodError(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_root";
    fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}
