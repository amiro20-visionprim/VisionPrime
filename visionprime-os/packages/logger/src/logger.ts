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

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Minimal structured logger wrapper. Real transport (pino, etc.) can be
 * swapped in behind this same interface in a later phase without callers
 * changing — callers only ever depend on the Logger interface.
 */
export function createLogger(scope: string, level: LogLevel = "info"): Logger {
  function write(logLevel: LogLevel, message: string, context: LogContext = {}) {
    if (LEVEL_WEIGHT[logLevel] < LEVEL_WEIGHT[level]) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level: logLevel,
      scope,
      message,
      ...context,
    };

    const line = JSON.stringify(entry);
    if (logLevel === "error") {
      console.error(line);
    } else if (logLevel === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  return {
    debug: (message, context) => write("debug", message, context),
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context),
    child: (bindings) => createLogger(scope, level) && createChildLogger(scope, level, bindings),
  };
}

function createChildLogger(scope: string, level: LogLevel, bindings: LogContext): Logger {
  const base = createLogger(scope, level);
  return {
    debug: (message, context) => base.debug(message, { ...bindings, ...context }),
    info: (message, context) => base.info(message, { ...bindings, ...context }),
    warn: (message, context) => base.warn(message, { ...bindings, ...context }),
    error: (message, context) => base.error(message, { ...bindings, ...context }),
    child: (more) => createChildLogger(scope, level, { ...bindings, ...more }),
  };
}
