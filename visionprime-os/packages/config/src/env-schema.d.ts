import { z } from "zod";
/**
 * Required base environment variables for Phase 01 (foundation only).
 * Module-specific variables are added alongside their modules in later
 * phases — never bolted onto this schema speculatively.
 */
export declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "test", "production"]>>;
    PORT: z.ZodDefault<z.ZodNumber>;
    API_BASE_URL: z.ZodString;
    DATABASE_URL: z.ZodString;
    REDIS_URL: z.ZodString;
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "test" | "production";
    PORT: number;
    API_BASE_URL: string;
    DATABASE_URL: string;
    REDIS_URL: string;
    LOG_LEVEL: "debug" | "info" | "warn" | "error";
}, {
    API_BASE_URL: string;
    DATABASE_URL: string;
    REDIS_URL: string;
    NODE_ENV?: "development" | "test" | "production" | undefined;
    PORT?: number | undefined;
    LOG_LEVEL?: "debug" | "info" | "warn" | "error" | undefined;
}>;
export type Env = z.infer<typeof envSchema>;
