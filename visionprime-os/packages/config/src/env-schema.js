"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envSchema = void 0;
const zod_1 = require("zod");
/**
 * Required base environment variables for Phase 01 (foundation only).
 * Module-specific variables are added alongside their modules in later
 * phases — never bolted onto this schema speculatively.
 */
exports.envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]).default("development"),
    PORT: zod_1.z.coerce.number().int().positive().default(4000),
    API_BASE_URL: zod_1.z.string().url(),
    DATABASE_URL: zod_1.z.string().min(1, "DATABASE_URL is required"),
    REDIS_URL: zod_1.z.string().min(1, "REDIS_URL is required"),
    LOG_LEVEL: zod_1.z.enum(["debug", "info", "warn", "error"]).default("info"),
});
