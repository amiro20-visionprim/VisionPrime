/**
 * Cross-cutting, stable error codes shared by the API and all clients.
 * Module-specific codes are added in later phases alongside their modules.
 */
export declare const ERROR_CODES: {
    readonly VALIDATION_FAILED: "VALIDATION_FAILED";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly PERMISSION_DENIED: "PERMISSION_DENIED";
    readonly AUTH_REQUIRED: "AUTH_REQUIRED";
    readonly AUTH_INVALID_TOKEN: "AUTH_INVALID_TOKEN";
    readonly RATE_LIMITED: "RATE_LIMITED";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
};
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
