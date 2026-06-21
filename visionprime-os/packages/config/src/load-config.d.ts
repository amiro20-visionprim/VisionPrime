import { Env } from "./env-schema";
export declare class EnvironmentValidationError extends Error {
    readonly details: Record<string, string>;
    constructor(details: Record<string, string>);
}
/**
 * Validates and loads environment variables into a typed config object.
 * Throws EnvironmentValidationError if any required variable is missing
 * or invalid — fails fast at startup rather than at first use.
 */
export declare function loadConfig(source?: Record<string, string | undefined>): Env;
