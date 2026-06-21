import { envSchema, Env } from "./env-schema";

export class EnvironmentValidationError extends Error {
  public readonly details: Record<string, string>;

  constructor(details: Record<string, string>) {
    super("Environment validation failed");
    this.name = "EnvironmentValidationError";
    this.details = details;
  }
}

/**
 * Validates and loads environment variables into a typed config object.
 * Throws EnvironmentValidationError if any required variable is missing
 * or invalid — fails fast at startup rather than at first use.
 */
export function loadConfig(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "unknown";
      details[key] = issue.message;
    }
    throw new EnvironmentValidationError(details);
  }

  return result.data;
}
