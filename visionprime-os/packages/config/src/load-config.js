"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentValidationError = void 0;
exports.loadConfig = loadConfig;
const env_schema_1 = require("./env-schema");
class EnvironmentValidationError extends Error {
    constructor(details) {
        super("Environment validation failed");
        this.name = "EnvironmentValidationError";
        this.details = details;
    }
}
exports.EnvironmentValidationError = EnvironmentValidationError;
/**
 * Validates and loads environment variables into a typed config object.
 * Throws EnvironmentValidationError if any required variable is missing
 * or invalid — fails fast at startup rather than at first use.
 */
function loadConfig(source = process.env) {
    const result = env_schema_1.envSchema.safeParse(source);
    if (!result.success) {
        const details = {};
        for (const issue of result.error.issues) {
            const key = issue.path.join(".") || "unknown";
            details[key] = issue.message;
        }
        throw new EnvironmentValidationError(details);
    }
    return result.data;
}
