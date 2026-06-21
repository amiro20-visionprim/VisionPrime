"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_CODES = void 0;
/**
 * Cross-cutting, stable error codes shared by the API and all clients.
 * Module-specific codes are added in later phases alongside their modules.
 */
exports.ERROR_CODES = {
    VALIDATION_FAILED: "VALIDATION_FAILED",
    NOT_FOUND: "NOT_FOUND",
    PERMISSION_DENIED: "PERMISSION_DENIED",
    AUTH_REQUIRED: "AUTH_REQUIRED",
    AUTH_INVALID_TOKEN: "AUTH_INVALID_TOKEN",
    RATE_LIMITED: "RATE_LIMITED",
    INTERNAL_ERROR: "INTERNAL_ERROR",
};
