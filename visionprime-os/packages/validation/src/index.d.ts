import { z, ZodSchema } from "zod";
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
export declare function validate<T>(schema: ZodSchema<T>, input: unknown): ValidationResult<T>;
