import { z } from "zod";

/**
 * Required base environment variables for Phase 01 (foundation only).
 * Module-specific variables are added alongside their modules in later
 * phases — never bolted onto this schema speculatively.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // --- Phase 03: auth/session tokens — secrets only ever come from env. ---
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET is required (min 16 chars)"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET is required (min 16 chars)"),
  JWT_ACCESS_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
});

export type Env = z.infer<typeof envSchema>;
