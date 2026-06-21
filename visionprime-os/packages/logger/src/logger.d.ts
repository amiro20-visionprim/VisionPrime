export type LogLevel = "debug" | "info" | "warn" | "error";
export interface LogContext {
    [key: string]: unknown;
}
export interface Logger {
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, context?: LogContext): void;
    child(bindings: LogContext): Logger;
}
/**
 * Minimal structured logger wrapper. Real transport (pino, etc.) can be
 * swapped in behind this same interface in a later phase without callers
 * changing — callers only ever depend on the Logger interface.
 */
export declare function createLogger(scope: string, level?: LogLevel): Logger;
