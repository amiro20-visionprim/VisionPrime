import { loadConfig, EnvironmentValidationError } from "@visionprime/config";
import { createLogger } from "@visionprime/logger";
import { createPool } from "@visionprime/database";
import { createApp } from "./app";

const bootstrapLogger = createLogger("api:bootstrap");

try {
  const config = loadConfig();
  const logger = createLogger("api", config.LOG_LEVEL);
  const db = createPool({ url: config.DATABASE_URL });
  const app = createApp(logger, {
    db,
    jwt: {
      accessSecret: config.JWT_ACCESS_SECRET,
      refreshSecret: config.JWT_REFRESH_SECRET,
      accessTtlMinutes: config.JWT_ACCESS_TTL_MINUTES,
      refreshTtlDays: config.JWT_REFRESH_TTL_DAYS,
    },
  });

  app.listen(config.PORT, () => {
    logger.info(`VisionPrime API listening on port ${config.PORT}`, {
      env: config.NODE_ENV,
    });
  });
} catch (err) {
  if (err instanceof EnvironmentValidationError) {
    bootstrapLogger.error("Environment validation failed — refusing to start", {
      details: err.details,
    });
    process.exit(1);
  }

  bootstrapLogger.error("Failed to start API", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
}
