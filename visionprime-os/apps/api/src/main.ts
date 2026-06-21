import { loadConfig, EnvironmentValidationError } from "@visionprime/config";
import { createLogger } from "@visionprime/logger";
import { createApp } from "./app";

const bootstrapLogger = createLogger("api:bootstrap");

try {
  const config = loadConfig();
  const logger = createLogger("api", config.LOG_LEVEL);
  const app = createApp(logger);

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
